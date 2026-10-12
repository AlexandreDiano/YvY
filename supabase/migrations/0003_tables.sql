-- Yvy — tabelas.
--
-- Diferenças deliberadas em relação à seção 3.1 do contexto, todas no sentido
-- de guardar menos dado pessoal:
--   * profiles não tem coordenada. O pareamento é por bairro/cidade/UF (texto),
--     que é a granularidade que o app promete na seção 5.2.
--   * voters não tem coordenada nem endereço: só uma referência livre
--     (address_hint) que o puxador usa para achar a casa.
--   * voters ganhou registered_by + consent_source, porque cadastrar outra
--     pessoa é a operação mais sensível do app e precisa de rastro.

create table profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  role               user_role not null default 'visitor',
  membership_status  membership_status not null default 'active',
  full_name          text,
  display_name       text not null,
  phone              text unique,
  email              text unique,
  cep                text check (cep is null or cep ~ '^[0-9]{8}$'),
  neighborhood       text,
  city               text,
  state              text check (state is null or char_length(state) = 2),
  location_precision smallint not null default 3 check (location_precision between 1 and 4),
  avatar_url         text,
  show_avatar        boolean not null default false,
  is_active          boolean not null default true,
  invited_by         uuid references profiles(id) on delete set null,
  notify_actions     boolean not null default true,
  notify_feed        boolean not null default false,
  notify_pull        boolean not null default true,
  terms_accepted_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table actions (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(title) between 4 and 120),
  description      text check (description is null or char_length(description) <= 2000),
  type             action_type not null,
  status           action_status not null default 'draft',
  scheduled_at     timestamptz not null,
  location_name    text,
  lat              double precision check (lat is null or lat between -90 and 90),
  lng              double precision check (lng is null or lng between -180 and 180),
  location         geography(point, 4326) generated always as (
                     case when lat is not null and lng is not null
                       then st_setsrid(st_makepoint(lng, lat), 4326)::geography
                     end
                   ) stored,
  neighborhood     text,
  city             text,
  state            text,
  max_participants int check (max_participants is null or max_participants > 0),
  created_by       uuid not null references profiles(id) on delete cascade,
  visibility       text not null default 'base' check (visibility in ('base', 'public')),
  cancel_reason    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table action_participants (
  id            uuid primary key default gen_random_uuid(),
  action_id     uuid not null references actions(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  status        text not null default 'confirmed' check (status in ('confirmed', 'pending', 'cancelled')),
  checked_in_at timestamptz,
  created_at    timestamptz not null default now(),
  unique (action_id, user_id)
);

create table posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references profiles(id) on delete cascade,
  content        text not null check (char_length(content) between 1 and 500),
  image_url      text,
  neighborhood   text not null,
  city           text not null,
  state          text not null,
  status         post_status not null default 'pending',
  moderator_id   uuid references profiles(id) on delete set null,
  moderator_note text,
  flagged_count  int not null default 0,
  created_at     timestamptz not null default now()
);

create table post_flags (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  flagger_id uuid not null references profiles(id) on delete cascade,
  reason     text not null check (reason in ('spam', 'provocacao', 'sem_fonte', 'ofensa', 'outro')),
  detail     text check (detail is null or char_length(detail) <= 200),
  created_at timestamptz not null default now(),
  unique (post_id, flagger_id)
);

create table proposal_cards (
  id              uuid primary key default gen_random_uuid(),
  area            text not null,
  title           text not null,
  what_they_said  text not null,
  source_url      text,
  source_name     text,
  source_date     date,
  what_it_means   text not null,
  who_is_affected text not null,
  comparison      text,
  severity        text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table fact_checks (
  id          uuid primary key default gen_random_uuid(),
  claim_text  text not null,
  result      check_result not null,
  explanation text not null,
  source_url  text,
  source_name text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table pull_routes (
  id           uuid primary key default gen_random_uuid(),
  puller_id    uuid references profiles(id) on delete set null,
  neighborhood text not null,
  city         text not null,
  state        text not null,
  max_voters   int not null default 5 check (max_voters between 1 and 10),
  is_complete  boolean not null default false,
  created_at   timestamptz not null default now()
);

-- DADO PESSOAL DE TERCEIRO. Ver supabase/migrations/0007_retention.sql: esta
-- tabela é expurgada depois da votação.
create table voters (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  zone          text not null,
  section       text not null,
  polling_place text not null,
  cep           text check (cep is null or cep ~ '^[0-9]{8}$'),
  neighborhood  text,
  city          text,
  state         text,
  address_hint  text check (address_hint is null or char_length(address_hint) <= 140),
  registered_by uuid references profiles(id) on delete set null,
  consent_source consent_source not null default 'self',
  pulled_by     uuid references profiles(id) on delete set null,
  pull_route_id uuid references pull_routes(id) on delete set null,
  has_voted     boolean not null default false,
  voted_at      timestamptz,
  created_at    timestamptz not null default now()
);

create table invites (
  id          uuid primary key default gen_random_uuid(),
  token       uuid unique not null default gen_random_uuid(),
  created_by  uuid not null references profiles(id) on delete cascade,
  used_by     uuid references profiles(id) on delete set null,
  max_uses    int not null default 1 check (max_uses between 1 and 20),
  use_count   int not null default 0,
  expires_at  timestamptz not null,
  is_table_qr boolean not null default false,
  event_name  text,
  created_ip  inet,
  created_at  timestamptz not null default now()
);

create table moderators (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  neighborhood text not null,
  city         text not null,
  state        text not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (user_id, neighborhood, city)
);

create table feature_flags (
  key         text primary key,
  is_enabled  boolean not null default false,
  description text,
  updated_at  timestamptz not null default now()
);

create table audit_log (
  id          bigserial primary key,
  user_id     uuid references profiles(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

-- Índices
create index idx_profiles_area on profiles (neighborhood, city, state) where is_active;
create index idx_profiles_invited_by on profiles (invited_by) where membership_status = 'pending';
create index idx_actions_area on actions (neighborhood, city, state, scheduled_at) where status in ('open', 'confirmed');
create index idx_actions_location on actions using gist (location);
create index idx_actions_creator on actions (created_by);
create index idx_participants_action on action_participants (action_id);
create index idx_posts_feed on posts (neighborhood, city, state, created_at desc) where status = 'published';
create index idx_posts_moderation on posts (neighborhood, city, created_at) where status in ('pending', 'flagged');
create index idx_posts_author on posts (author_id);
create index idx_cards_active on proposal_cards (area, sort_order) where is_active;
create index idx_checks_trgm on fact_checks using gin (claim_text gin_trgm_ops);
create index idx_voters_area on voters (neighborhood, city, state);
create index idx_voters_route on voters (pull_route_id);
create index idx_voters_place on voters (polling_place) where pull_route_id is null;
create index idx_routes_puller on pull_routes (puller_id);
create index idx_invites_token on invites (token);
create index idx_invites_open on invites (expires_at) where use_count < max_uses;
create index idx_moderators_area on moderators (neighborhood, city) where is_active;
create index idx_audit_user on audit_log (user_id, created_at desc);
