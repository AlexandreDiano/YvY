-- Yvy — Row Level Security.
--
-- ESTE ARQUIVO É O PERÍMETRO DE SEGURANÇA DO APP. O cliente React Native
-- carrega a anon key dentro do bundle: qualquer pessoa pode extrair a chave e
-- conversar direto com a API. O que separa "aberto por fora" de "fechado por
-- dentro" são as policies abaixo — não as telas.
--
-- Mudou policy? Rode `npm run test:rls` antes do commit.

alter table profiles            enable row level security;
alter table actions             enable row level security;
alter table action_participants enable row level security;
alter table posts               enable row level security;
alter table post_flags          enable row level security;
alter table proposal_cards      enable row level security;
alter table fact_checks         enable row level security;
alter table voters              enable row level security;
alter table pull_routes         enable row level security;
alter table invites             enable row level security;
alter table moderators          enable row level security;
alter table feature_flags       enable row level security;
alter table audit_log           enable row level security;

-- ============================================================
-- PROFILES — só o dono e o admin. Terceiros leem via profiles_public.
--
-- Não existe policy de INSERT: perfil nasce exclusivamente pela RPC
-- `redeem_invite` (SECURITY DEFINER), que exige QRCode válido. Sem convite não
-- há conta no Yvy — quem não tem convite lê o conteúdo público e pronto.
-- ============================================================

create policy profiles_select_self on profiles
  for select using (id = auth.uid());

create policy profiles_select_admin on profiles
  for select using (public.is_admin());

create policy profiles_update_self on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_admin on profiles
  for update using (public.is_admin());

-- RLS filtra LINHA, nunca COLUNA — inclusive na escrita. A policy acima deixa
-- a pessoa editar a própria linha, o que incluiria `role` e
-- `membership_status`: autopromoção a admin e autoconfirmação de militante
-- pendente (contra a regra de ouro 5 do fluxo 4.2). Quem fecha isso é
-- privilégio de coluna, não policy.
revoke update on profiles from authenticated;
grant update (
  display_name, full_name, phone, email, cep, neighborhood, city, state,
  location_precision, avatar_url, show_avatar,
  notify_actions, notify_feed, notify_pull, terms_accepted_at
) on profiles to authenticated;

-- Consequência: role, membership_status e is_active mudam apenas por RPC
-- SECURITY DEFINER (redeem_invite, decide_invitee) ou pelo SQL Editor. É assim
-- que o README promove admin.

-- Confirmar/rejeitar convidado NÃO é UPDATE direto: é a RPC decide_invitee,
-- que limita o que pode mudar. Ver 0004_functions.sql.

-- ============================================================
-- ACTIONS
-- ============================================================

create policy actions_select_public on actions
  for select using (visibility = 'public' and status in ('open', 'confirmed', 'completed'));

create policy actions_select_area on actions
  for select using (
    public.is_militant_or_above()
    and (neighborhood, city) = (select neighborhood, city from public.my_area())
  );

create policy actions_select_creator on actions
  for select using (created_by = auth.uid());

create policy actions_select_admin on actions
  for select using (public.is_admin());

create policy actions_insert_militant on actions
  for insert with check (
    public.is_militant_or_above()
    and created_by = auth.uid()
    and (neighborhood, city) = (select neighborhood, city from public.my_area())
  );

create policy actions_update_creator on actions
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy actions_update_admin on actions
  for update using (public.is_admin());

-- ============================================================
-- ACTION_PARTICIPANTS — quem confirmou presença só é visível para a própria
-- pessoa e para quem criou a ação. Para os outros existe só a contagem.
-- ============================================================

create policy participants_select_self on action_participants
  for select using (user_id = auth.uid());

create policy participants_select_creator on action_participants
  for select using (
    exists (select 1 from actions a where a.id = action_id and a.created_by = auth.uid())
  );

create policy participants_select_admin on action_participants
  for select using (public.is_admin());

create policy participants_insert_self on action_participants
  for insert with check (
    user_id = auth.uid()
    and public.is_militant_or_above()
    and exists (select 1 from actions a where a.id = action_id and a.status in ('open', 'confirmed'))
  );

create policy participants_update_self on action_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- POSTS
-- ============================================================

create policy posts_select_feed on posts
  for select using (
    status = 'published'
    and public.is_militant_or_above()
    and (neighborhood, city) = (select neighborhood, city from public.my_area())
  );

create policy posts_select_moderation on posts
  for select using (
    status in ('pending', 'flagged') and public.is_moderator_for(neighborhood, city)
  );

create policy posts_select_author on posts
  for select using (author_id = auth.uid());

create policy posts_select_admin on posts
  for select using (public.is_admin());

create policy posts_insert_militant on posts
  for insert with check (
    public.is_militant_or_above()
    and author_id = auth.uid()
    and status = 'pending'
    and (neighborhood, city) = (select neighborhood, city from public.my_area())
  );

create policy posts_update_moderator on posts
  for update using (public.is_moderator_for(neighborhood, city));

-- ============================================================
-- POST_FLAGS — denúncia é anônima para o denunciado: ninguém lê a lista
-- além de quem denunciou e da moderação do bairro.
-- ============================================================

create policy flags_select_self on post_flags
  for select using (flagger_id = auth.uid());

create policy flags_select_moderator on post_flags
  for select using (
    exists (
      select 1 from posts p
      where p.id = post_id and public.is_moderator_for(p.neighborhood, p.city)
    )
  );

create policy flags_insert_militant on post_flags
  for insert with check (public.is_militant_or_above() and flagger_id = auth.uid());

-- ============================================================
-- CONTEÚDO EDITORIAL — público para qualquer sessão, escrita só do admin.
-- ============================================================

create policy cards_select_all on proposal_cards
  for select using (is_active or public.is_admin());

create policy cards_write_admin on proposal_cards
  for all using (public.is_admin()) with check (public.is_admin());

create policy checks_select_all on fact_checks
  for select using (is_active or public.is_admin());

create policy checks_write_admin on fact_checks
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- VOTERS — dado pessoal de terceiro. A policy permissiva do contexto
-- (`using (auth.uid() is not null)`) deixava qualquer sessão logada ler nome,
-- zona, seção e local de votação de TODOS os eleitores do país. Removida.
-- Quem lê uma linha: o puxador daquela rota, quem fez o cadastro, e o admin.
-- ============================================================

create policy voters_select_puller on voters
  for select using (
    pulled_by = auth.uid()
    or pull_route_id in (select id from pull_routes where puller_id = auth.uid())
  );

create policy voters_select_registrar on voters
  for select using (registered_by = auth.uid());

create policy voters_select_admin on voters
  for select using (public.is_admin());

create policy voters_insert_any on voters
  for insert with check (auth.uid() is not null and registered_by = auth.uid());

create policy voters_update_puller on voters
  for update using (pulled_by = auth.uid() or public.is_admin());

-- Direito de exclusão (LGPD): quem cadastrou apaga, e o admin apaga qualquer um.
create policy voters_delete_registrar on voters
  for delete using (registered_by = auth.uid() or public.is_admin());

-- ============================================================
-- PULL_ROUTES
-- ============================================================

create policy routes_select_puller on pull_routes
  for select using (puller_id = auth.uid());

create policy routes_select_coordinator on pull_routes
  for select using (public.is_moderator_for(neighborhood, city));

create policy routes_update_puller on pull_routes
  for update using (puller_id = auth.uid() or public.is_moderator_for(neighborhood, city));

-- INSERT só pela RPC build_pull_routes (DEFINER), que checa coordenação.

-- ============================================================
-- INVITES — o convidado nunca lê esta tabela; ele usa a RPC redeem_invite.
-- ============================================================

create policy invites_select_creator on invites
  for select using (created_by = auth.uid());

create policy invites_select_admin on invites
  for select using (public.is_admin());

create policy invites_insert_militant on invites
  for insert with check (public.is_militant_or_above() and created_by = auth.uid());

-- ============================================================
-- MODERATORS / FEATURE_FLAGS / AUDIT_LOG
-- ============================================================

create policy moderators_select_self on moderators
  for select using (user_id = auth.uid());

create policy moderators_select_area on moderators
  for select using (public.is_militant_or_above() and (neighborhood, city) = (select neighborhood, city from public.my_area()));

create policy moderators_write_admin on moderators
  for all using (public.is_admin()) with check (public.is_admin());

create policy flags_write_admin on feature_flags
  for all using (public.is_admin()) with check (public.is_admin());

-- audit_log não aceita escrita de cliente: quem grava são os triggers e as
-- RPCs, todos SECURITY DEFINER. Uma policy de insert aberta só serviria para
-- alguém forjar rastro.

create policy audit_select_admin on audit_log
  for select using (public.is_admin());

-- ============================================================
-- O QUE EXISTE SEM CONTA
--
-- Quem não tem convite não tem conta — e ainda assim precisa ler propostas e
-- checagem (é o material que circula no WhatsApp, seção 10.2). Então o papel
-- `anon` recebe select nessas duas tabelas e mais nada. Estrutura de
-- mobilização (perfis, ações, feed, eleitores, convites) permanece fechada.
-- ============================================================

revoke all on all tables in schema public from anon;
grant usage on schema public to anon, authenticated;

grant select on proposal_cards, fact_checks, feature_flags to anon;
grant execute on function public.search_fact_checks(text, real) to anon;

-- As policies desse conteúdo não pedem sessão: `is_active` basta.
-- (`is_admin()` com auth.uid() nulo devolve false, então anon só vê o ativo.)
drop policy if exists flags_read_authenticated on feature_flags;
create policy flags_read_all on feature_flags
  for select using (true);
