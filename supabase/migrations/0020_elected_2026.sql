-- Yvy — eleitos em 2026 (e quem foi ao 2º turno), dados abertos do TSE.
--
-- Alimentada por scripts/import-tse-elected.py (gera supabase/seed/0004).
-- Dado público de candidatura: nome de urna, nome, partido, cargo, UF, votos.
-- Leitura aberta a `anon` (decisão de 11/10): a tela "Quem foi eleito" é
-- pública e serve para a pessoa conhecer quem vai representá-la.

create table if not exists elected_2026 (
  sq_candidato text primary key,     -- id da candidatura no TSE
  cargo        text not null,        -- Presidente, Governador, Senador, Deputado Federal/Estadual/Distrital
  uf           text not null,        -- 'BR' para Presidente
  nome_urna    text not null,
  nome         text not null,
  partido      text not null,
  situacao     text not null,        -- ELEITO, ELEITO POR QP, ELEITO POR MÉDIA, 2º TURNO
  votos        int  not null
);

create index if not exists idx_elected_2026_uf on elected_2026 (uf, cargo);

alter table elected_2026 enable row level security;
revoke all on elected_2026 from public, anon, authenticated;
grant select on elected_2026 to anon, authenticated;

drop policy if exists elected_2026_read on elected_2026;
create policy elected_2026_read on elected_2026 for select using (true);
