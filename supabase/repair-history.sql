-- Uma vez só, no SQL Editor da produção (19/10): alinha o histórico de
-- migrations do Supabase com os arquivos do repo, para o `supabase db push`
-- do workflow migrate.yml saber o que já foi aplicado.
--
-- Antes: 0001–0040 registradas com versão de data (aplicadas pelo painel) e
-- 0041–0045 aplicadas pelo SQL Editor, sem registro. Depois: versão = prefixo
-- do arquivo (0001 … 0045), que é como o CLI lê supabase/migrations.
-- 0046 em diante não entra aqui: o workflow aplica.

begin;

update supabase_migrations.schema_migrations
   set version = left(name, 4)
 where version ~ '^2026' and name ~ '^\d{4}_';

insert into supabase_migrations.schema_migrations (version, name, statements)
values ('0041', '0041_claim_review', '{}'),
       ('0042', '0042_drop_puxada', '{}'),
       ('0043', '0043_feed_regiao_imediata', '{}'),
       ('0044', '0044_review_and_suspend', '{}'),
       ('0045', '0045_region_follows', '{}')
on conflict (version) do nothing;

-- tem de dar 45 linhas, de 0001 a 0045
select count(*) as total, min(version), max(version)
  from supabase_migrations.schema_migrations;

commit;
