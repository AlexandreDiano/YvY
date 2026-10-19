-- Yvy — vigia da produção (19/10).
--
-- De hora em hora, health_watch() olha o que costuma quebrar calado e manda
-- aviso para os admins (tela Avisos; por e-mail para quem ligou, via
-- notify-email):
--   1. job do pg_cron que falhou;
--   2. Edge Function chamada pelo cron que respondeu erro (o net.http_post é
--      assíncrono: o job "dá certo" mesmo com a função caindo);
--   3. fila de checagem parada há mais de 2h;
--   4. e-mails do dia perto do teto do plano grátis do Resend (100/dia).
-- O mesmo aviso não se repete em menos de 6h.
--
-- De carona: norm_city e region_of eram executáveis por anon só pelo grant
-- padrão do Supabase (0043 revogou region_of_city, essas duas ficaram).
-- Visitante não lê post, então não precisa delas.
--
-- E profiles perde o privilégio de INSERT de authenticated. Já não tinha
-- policy de insert (perfil só nasce por redeem_invite, DEFINER); sem o
-- privilégio, um descuido futuro numa policy não abre a porta sozinho.
-- Mesma coisa para escrita no audit_log: quem grava são triggers e RPCs
-- DEFINER, nenhuma depende do privilégio do cliente.

revoke execute on function public.norm_city(text) from public, anon;
revoke execute on function public.region_of(text) from public, anon;
revoke insert on profiles from anon, authenticated;
revoke insert, update, delete, truncate on audit_log from anon, authenticated;

create or replace function public.health_watch() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_titles   text[] := '{}';
  v_bodies   text[] := '{}';
  v_jobs     text;
  v_n        int;
  v_sent     int := 0;
  i          int;
begin
  select string_agg(distinct j.jobname, ', ') into v_jobs
    from cron.job_run_details d join cron.job j on j.jobid = d.jobid
   where d.status = 'failed' and d.start_time > now() - interval '1 hour';
  if v_jobs is not null then
    v_titles := array_append(v_titles, 'Yvy: rotina agendada falhou'); v_bodies := array_append(v_bodies, ('Falhou na última hora: ' || v_jobs || '.'));
  end if;

  begin
    select count(*) into v_n from net._http_response
     where created > now() - interval '1 hour'
       and (status_code >= 400 or error_msg is not null or timed_out);
    if v_n > 0 then
      v_titles := array_append(v_titles, 'Yvy: Edge Function com erro'); v_bodies := array_append(v_bodies, (v_n || ' chamada(s) do cron com erro na última hora.'));
    end if;
  exception when undefined_table then
    null; -- pg_net sem tabela de resposta: pula esse item
  end;

  select count(*) into v_n from claim_checks
   where status = 'queued' and queued_at < now() - interval '2 hours';
  if v_n > 0 then
    v_titles := array_append(v_titles, 'Yvy: fila de checagem parada'); v_bodies := array_append(v_bodies, (v_n || ' pedido(s) parados há mais de 2h.'));
  end if;

  select count(*) into v_n
    from notifications n join profiles p on p.id = n.user_id
   where n.emailed_at > now() - interval '1 day' and p.notify_email;
  if v_n >= 80 then
    v_titles := array_append(v_titles, 'Yvy: e-mails perto do teto'); v_bodies := array_append(v_bodies, (v_n || ' e-mails nas últimas 24h (teto do Resend grátis: 100/dia).'));
  end if;

  for i in 1 .. coalesce(array_length(v_titles, 1), 0) loop
    insert into notifications (user_id, kind, title, body)
    select p.id, 'health', v_titles[i], v_bodies[i]
      from profiles p
     where p.role = 'admin' and p.is_active
       and not exists (
         select 1 from notifications n
          where n.user_id = p.id and n.kind = 'health' and n.title = v_titles[i]
            and n.created_at > now() - interval '6 hours');
    get diagnostics v_n = row_count;
    v_sent := v_sent + v_n;
  end loop;
  return v_sent;
end;
$$;
revoke execute on function public.health_watch() from public, anon, authenticated;

select cron.schedule('health-watch', '20 * * * *', $$select public.health_watch()$$);
