-- Yvy — retenção e expurgo de dados.
--
-- A puxada de voto guarda nome e local de votação de pessoas que podem nunca
-- ter usado o app. Esse dado tem prazo: serve para 25/10/2026 e depois sai.
-- Sem isto, o banco vira um cadastro eleitoral permanente — exatamente o que
-- o app promete não ser.

/**
 * Apaga eleitores e rotas de puxada. Rodar depois da votação.
 * Admin apenas. Registra no audit_log quantas linhas saíram (sem conteúdo).
 */
create or replace function public.purge_pull_data() returns table (voters_deleted int, routes_deleted int)
language plpgsql security definer set search_path = public as $$
declare
  v_voters int;
  v_routes int;
begin
  if not public.is_admin() then
    raise exception 'Só admin expurga dados de puxada.' using errcode = '42501';
  end if;

  delete from voters;
  get diagnostics v_voters = row_count;

  delete from pull_routes;
  get diagnostics v_routes = row_count;

  insert into audit_log (user_id, action, entity_type, metadata)
  values (auth.uid(), 'purge_pull_data', 'voters',
          jsonb_build_object('voters', v_voters, 'routes', v_routes));

  return query select v_voters, v_routes;
end;
$$;

/** Log de auditoria: retenção de 90 dias (seção 5.3, item 7). */
create or replace function public.purge_audit_log() returns int
language sql security definer set search_path = public as $$
  with gone as (
    delete from audit_log where created_at < now() - interval '90 days' returning 1
  )
  select count(*)::int from gone;
$$;

-- Agendamento: ver 0010_cron.sql.
--
-- O expurgo da puxada NÃO é agendado de propósito: é um ato consciente da
-- coordenação depois da apuração. Rodar manualmente:
--
--   select * from public.purge_pull_data();
