-- Yvy — puxada de voto sai do app de vez (decisão de 15/10, orientação do
-- advogado eleitoral). Desligada desde a 0039; as três tabelas estavam vazias
-- quando esta migration foi escrita.
--
-- Fica para trás só o valor 'puxada_voto' no enum action_type: Postgres não
-- remove valor de enum sem recriar o tipo, e nenhuma ação usa. A trava abaixo
-- impede que alguém crie ação desse tipo pela API.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'auto-purge-pull-data') then
    perform cron.unschedule('auto-purge-pull-data');
  end if;
end;
$$;

drop trigger if exists voters_require_module on voters;

drop function if exists public.voters_require_module();
drop function if exists public.auto_purge_pull_data();
drop function if exists public.purge_pull_data();
drop function if exists public.build_pull_routes(text, text, text, int);

drop table if exists pull_results;
drop table if exists pull_routes;
drop table if exists voters;

drop type if exists consent_source;

delete from feature_flags where key = 'module_puxada';

alter table actions
  add constraint actions_no_puxada check (type <> 'puxada_voto') not valid;
alter table actions validate constraint actions_no_puxada;

alter table profiles drop column if exists notify_pull;
