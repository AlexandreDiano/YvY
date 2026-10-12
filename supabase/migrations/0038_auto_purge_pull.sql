-- Yvy — expurgo AUTOMÁTICO da puxada em 26/10/2026, 00:00 de Brasília (YVY-58).
--
-- Decisão de 12/10: antes o expurgo era manual (0010 — "ato consciente da
-- coordenação"); agora é automático, para não depender de alguém lembrar.
-- 25/10 é o 2º turno: depois dele os dados da puxada não servem para nada.
--
-- O que sai: SÓ `voters` (eleitores cadastrados para a puxada — vizinhos,
-- parentes e também quem se cadastrou como eleitor) e `pull_routes` (rotas).
-- O que fica: tudo o mais — perfis/contas de membros, convites, posts, ações,
-- avisos. Nenhuma outra tabela aponta para essas duas.
--
-- Antes de apagar, guarda SÓ números por bairro em `pull_results` (sem nome,
-- seção nem local de ninguém), para a coordenação ter o balanço. Depois avisa
-- cada admin no app e desliga o próprio agendamento.

create table if not exists pull_results (
  id          bigserial primary key,
  neighborhood text,
  city        text,
  state       text,
  registered  int not null,
  voted       int not null,
  routes      int not null,
  purged_at   timestamptz not null default now()
);
alter table pull_results enable row level security;
revoke all on pull_results from public, anon, authenticated;
grant select on pull_results to authenticated;
drop policy if exists pull_results_admin on pull_results;
create policy pull_results_admin on pull_results for select using (public.is_admin());

create or replace function public.auto_purge_pull_data() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_voters int;
  v_routes int;
  v_voted int;
begin
  -- 26/10/2026 00:00 em Brasília. Antes disso não faz nada.
  if now() < timestamptz '2026-10-26 00:00:00-03' then
    return 0;
  end if;

  select count(*), count(*) filter (where has_voted) into v_voters, v_voted from voters;
  select count(*) into v_routes from pull_routes;

  if v_voters > 0 or v_routes > 0 then
    -- Balanço por bairro, sem dado pessoal.
    insert into pull_results (neighborhood, city, state, registered, voted, routes)
    select neighborhood, city, max(state), sum(reg)::int, sum(voted)::int, sum(rt)::int
      from (select neighborhood, city, state, 1 as reg, has_voted::int as voted, 0 as rt from voters
            union all
            select neighborhood, city, state, 0, 0, 1 from pull_routes) x
     group by neighborhood, city;

    delete from voters;
    delete from pull_routes;

    insert into audit_log (user_id, action, entity_type, metadata)
    values (null, 'purge_pull_data', 'voters',
            jsonb_build_object('voters', v_voters, 'routes', v_routes, 'via', 'auto_26_10'));

    insert into notifications (user_id, kind, title, body)
    select p.id, 'admin_purge_done',
           'Dados da puxada apagados',
           'Expurgo automático de 26/10 feito: ' || v_voters || ' eleitores (' || v_voted
             || ' votaram) e ' || v_routes || ' rotas apagados. O balanço por bairro, sem nomes, '
             || 'ficou em pull_results. Falta conferir a validade dos backups e atualizar a Privacidade (YVY-58).'
      from profiles p
     where p.role = 'admin' and p.is_active;
  end if;

  -- Serviço feito: tira o agendamento (só existe no banco com pg_cron).
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule('auto-purge-pull-data');
  end if;
  return v_voters;
end;
$$;

revoke execute on function public.auto_purge_pull_data() from public, anon, authenticated;

-- 03:00 UTC = 00:00 em Brasília. Roda todo dia (antes de 26/10 não faz nada);
-- na primeira execução depois de 26/10 apaga e se desagenda.
select cron.schedule('auto-purge-pull-data', '0 3 * * *',
                     $$select public.auto_purge_pull_data()$$);
