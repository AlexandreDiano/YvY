-- Yvy — planos de governo dentro do app.
--
-- O PDF oficial vem dos dados abertos do TSE (proposta_governo_2026_UF.zip) e
-- fica num bucket público: é documento público registrado pelo candidato.
-- `items` são propostas COPIADAS do texto do plano (com página), nunca
-- resumidas: regra editorial do projeto. A IA só localiza os trechos; cada
-- item é conferido palavra a palavra contra o texto do PDF antes de aparecer
-- (`verified`). Item que não bate com o PDF não é mostrado.

insert into storage.buckets (id, name, public)
values ('planos-governo', 'planos-governo', true)
on conflict (id) do update set public = true;

create table if not exists government_plans (
  sq_candidato text primary key,
  nome_urna    text not null,
  cargo        text not null,
  uf           text not null,
  partido      text not null,
  pdf_url      text not null,
  pages        int,
  items        jsonb not null default '[]'::jsonb, -- [{tema, texto, pagina}]
  verified     boolean not null default false,
  updated_at   timestamptz not null default now()
);

alter table government_plans enable row level security;
revoke all on government_plans from public, anon, authenticated;
grant select on government_plans to anon, authenticated;
drop policy if exists government_plans_read on government_plans;
create policy government_plans_read on government_plans for select using (true);
