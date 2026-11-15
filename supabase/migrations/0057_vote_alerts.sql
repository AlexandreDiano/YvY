-- Votação em pauta vira chamado para a consulta pública (DIANO-136, decisão
-- de 15/11).
--
-- A Edge Function vote-alerts lê a pauta do Plenário da Câmara e do Senado
-- dos próximos 7 dias e compara a ementa com a lista de palavras-chave da
-- equipe. O que bater vira aviso para todo membro confirmado e ativo que não
-- desligou "Votações em pauta" no Perfil, com o link da consulta pública
-- onde o cidadão vota antes da sessão: e-Cidadania no Senado, enquete na
-- Câmara (as duas usam o mesmo código da proposição).
--
-- Exceção à regra "nada de destaques" das telas de transparência
-- (src/api/officials/shared.ts), decidida pelo dono do projeto: a escolha do
-- que avisa é da lista de palavras-chave. O texto do aviso continua só com o
-- que a fonte oficial publica: sigla, número, ano, ementa, data e link.

-- ------------------------------------------------------- preferência
alter table profiles add column if not exists notify_votes boolean not null default true;
grant update (notify_votes) on profiles to authenticated;

-- ------------------------------------------------------- palavras-chave
-- Termo é palavra inteira, sem acento nem maiúscula; * no fim vale como
-- começo de palavra; - na frente exclui (supabase/functions/vote-alerts/match.ts).
create table if not exists vote_alert_keywords (
  term       text primary key check (char_length(btrim(term)) between 2 and 60),
  created_by uuid default auth.uid() references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table vote_alert_keywords enable row level security;
revoke all on vote_alert_keywords from public, anon, authenticated;
grant select, insert, delete on vote_alert_keywords to authenticated;

-- a lista decide o que a base recebe: só admin mexe
create policy vote_alert_keywords_admin_select on vote_alert_keywords
  for select using (public.is_admin());
create policy vote_alert_keywords_admin_insert on vote_alert_keywords
  for insert with check (public.is_admin());
create policy vote_alert_keywords_admin_delete on vote_alert_keywords
  for delete using (public.is_admin());

do $$
begin
  if exists (select 1 from pg_proc where proname = 'audit_attach') then
    perform public.audit_attach('vote_alert_keywords');
  end if;
end;
$$;

-- Lista inicial, conferida contra a pauta real de ago–nov/2026 (15 avisos em
-- 4 meses). Admin muda pelo app (Moderar › Votações em pauta).
insert into vote_alert_keywords (term, created_by) values
  ('trabalhador*', null), ('trabalhista*', null), ('jornada de trabalho', null),
  ('duracao maxima semanal', null), ('repouso semanal', null), ('6x1', null),
  ('consolidacao das leis do trabalho', null), ('clt', null), ('salario minimo', null),
  ('piso salarial', null), ('escala 6x1', null), ('terceiriz*', null), ('sindicat*', null),
  ('sindical', null), ('aposentad*', null), ('previdencia', null), ('previdenciari*', null),
  ('imposto de renda', null), ('reforma tributaria', null), ('grandes fortunas', null),
  ('dividendos', null), ('arcabouco fiscal', null), ('privatiz*', null), ('desestatiz*', null),
  ('petrobras', null), ('eletrobras', null), ('correios', null), ('sus', null),
  ('sistema unico de saude', null), ('educacao publica', null), ('escola publica', null),
  ('bolsa familia', null), ('moradia', null), ('minha casa, minha vida', null),
  ('reforma agraria', null), ('demarcac*', null), ('indigena*', null), ('quilombol*', null),
  ('marco temporal', null), ('agrotox*', null), ('licenciamento ambiental', null),
  ('desmatamento', null), ('aborto', null), ('lgbt*', null), ('racismo', null),
  ('feminicidio', null), ('violencia contra a mulher', null), ('armas de fogo', null),
  ('porte de arma*', null), ('anistia', null), ('plataformas digitais', null),
  ('desinformacao', null), ('tarifa zero', null),
  ('-vara do trabalho', null), ('-varas do trabalho', null),
  ('-tribunal regional do trabalho', null), ('-juiz do trabalho', null), ('-sessao especial', null)
on conflict (term) do nothing;

-- ------------------------------------------------------- alertas
-- Uma linha por proposição em cada casa. Dado de script (fora da auditoria).
create table if not exists vote_alerts (
  id          uuid primary key default gen_random_uuid(),
  casa        text not null check (casa in ('camara', 'senado', 'congresso')),
  prop_id     text not null,
  title       text not null,
  ementa      text not null,
  url         text not null check (url ~ '^https://[a-z0-9.]+\.leg\.br/'),
  -- consulta pública; sessão do Congresso Nacional não tem
  vote_url    text check (vote_url ~ '^https://[a-z0-9.]+\.leg\.br/'),
  session_at  timestamptz not null,
  matched     text[] not null default '{}',
  notified_at timestamptz not null default now(),
  unique (casa, prop_id)
);
alter table vote_alerts enable row level security;
revoke all on vote_alerts from public, anon, authenticated;
grant select on vote_alerts to authenticated;

-- quem recebe o aviso abre o link oficial por ele
create policy vote_alerts_select_members on vote_alerts
  for select using (public.is_militant_or_above());

/**
 * Chamada pela Edge Function (service_role). Grava a proposição e avisa a
 * base. Proposição que já avisou nos últimos 60 dias só atualiza a data da
 * sessão: o mesmo projeto costuma ficar semanas na pauta. Devolve true se
 * avisou.
 */
create or replace function public.vote_alert_publish(
  p_casa text, p_prop_id text, p_title text, p_ementa text, p_url text,
  p_vote_url text, p_session_at timestamptz, p_matched text[]
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  v_last timestamptz;
begin
  select id, notified_at into v_id, v_last
    from vote_alerts where casa = p_casa and prop_id = p_prop_id
    for update;

  if v_last is not null and v_last > now() - interval '60 days' then
    update vote_alerts set session_at = p_session_at where id = v_id;
    return false;
  end if;

  insert into vote_alerts (casa, prop_id, title, ementa, url, vote_url, session_at, matched, notified_at)
  values (p_casa, p_prop_id, p_title, p_ementa, p_url, p_vote_url, p_session_at, coalesce(p_matched, '{}'), now())
  on conflict (casa, prop_id) do update
     set title = excluded.title, ementa = excluded.ementa, url = excluded.url, vote_url = excluded.vote_url,
         session_at = excluded.session_at, matched = excluded.matched, notified_at = now()
  returning id into v_id;

  insert into notifications (user_id, kind, title, body, ref_id)
  select p.id,
         'vote_alert',
         p_title,
         'Sessão de ' || to_char(p_session_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI')
           || case when p_vote_url is not null
                   then '. A consulta pública está aberta: dê sua opinião antes da votação.'
                   else '.' end
           || E'\n\n' || left(p_ementa, 400) || case when char_length(p_ementa) > 400 then '…' else '' end,
         v_id
    from profiles p
   where p.is_active
     and p.role in ('militant', 'moderator', 'admin')
     and p.membership_status = 'active'
     and p.notify_votes;
  return true;
end;
$$;
revoke execute on function public.vote_alert_publish(text, text, text, text, text, text, timestamptz, text[])
  from public, anon, authenticated;
grant execute on function public.vote_alert_publish(text, text, text, text, text, text, timestamptz, text[])
  to service_role;

-- ------------------------------------------------------- cron
-- Pauta sai em cima da hora (a Câmara publica na véspera ou no dia): de 3 em
-- 3 horas das 7h às 22h de Brasília (cron em UTC). Sem palavra-chave, nem chama.
select cron.schedule('vote-alerts', '0 1,10,13,16,19,22 * * *', $$
  select net.http_post(
    url     := 'https://qbxdoprekyynzcwdtvuw.supabase.co/functions/v1/vote-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'claim_cron_key')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000)
  where exists (select 1 from public.vote_alert_keywords where term not like '-%');
$$);
