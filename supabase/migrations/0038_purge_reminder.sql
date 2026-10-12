-- Yvy — lembrete para o admin expurgar os dados da puxada (YVY-58).
--
-- O expurgo NÃO é automático, de propósito (0010): é um ato consciente da
-- coordenação depois da votação. Mas não pode ser esquecido. A partir de
-- 26/10/2026, todo dia às 9h de Brasília, cada admin ativo recebe um aviso no
-- app (Avisos + contador da Base) — enquanto ainda houver eleitor ou rota de
-- puxada no banco. Feito o expurgo, o lembrete para sozinho.
--
-- Data de início fixa aqui (não sai de feature flag): 25/10 é o 2º turno.

create or replace function public.remind_purge_pull_data() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_voters int;
  v_routes int;
  v_sent int := 0;
begin
  -- 26/10/2026 00:00 em Brasília.
  if now() < timestamptz '2026-10-26 00:00:00-03' then
    return 0;
  end if;

  select count(*) into v_voters from voters;
  select count(*) into v_routes from pull_routes;
  if v_voters = 0 and v_routes = 0 then
    return 0;
  end if;

  insert into notifications (user_id, kind, title, body)
  select p.id, 'admin_purge_reminder',
         'Hora de apagar os dados da puxada',
         'A eleição acabou e ainda há ' || v_voters || ' eleitores e ' || v_routes
           || ' rotas no banco. Siga o roteiro da YVY-58: exportar só os números por bairro, '
           || 'apagar eleitores e rotas no SQL Editor, conferir 0/0 e atualizar a Privacidade. '
           || 'Este aviso se repete todo dia até o expurgo.'
    from profiles p
   where p.role = 'admin' and p.is_active;
  get diagnostics v_sent = row_count;
  return v_sent;
end;
$$;

revoke execute on function public.remind_purge_pull_data() from public, anon, authenticated;

-- 12:00 UTC = 09:00 em Brasília. Roda todo dia; antes de 26/10 não faz nada.
select cron.schedule('remind-purge-pull-data', '0 12 * * *',
                     $$select public.remind_purge_pull_data()$$);
