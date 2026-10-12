-- Yvy — "versão simples" das ementas e descrições oficiais (votações e
-- consultas públicas), escrita por IA e guardada para não gerar de novo.
--
-- Cada texto oficial vira uma linha, pela sha256 do texto. A Edge Function
-- `simplify` (service role) gera e grava; o app lê pela RPC abaixo. Tabela
-- fechada para a API. Texto oficial é público; não há dado pessoal aqui.
--
-- A versão simples sai sempre rotulada como "resumo por IA" ao lado do link
-- para o original. Não é conteúdo editorial: explica o que a proposta
-- oficial diz, não o que um candidato fará.

create table if not exists plain_texts (
  hash        text primary key,           -- sha256 hex do texto original
  original    text not null,
  simple      text not null,
  model       text not null,
  created_at  timestamptz not null default now()
);

alter table plain_texts enable row level security;
revoke all on plain_texts from public, anon, authenticated;

/** Versões simples já guardadas para estes textos (por hash). */
create or replace function public.get_plain_texts(p_hashes text[])
returns table (hash text, simple text)
language sql stable security definer set search_path = public as $$
  select p.hash, p.simple from plain_texts p where p.hash = any(p_hashes[1:100]);
$$;

revoke execute on function public.get_plain_texts(text[]) from public;
grant  execute on function public.get_plain_texts(text[]) to anon, authenticated;
