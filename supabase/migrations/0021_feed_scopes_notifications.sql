-- Yvy — feed em níveis, apagar o próprio post e aviso de moderação.
--
-- 1. Níveis do feed (decisão de 11/10): bairro, estado, região, Brasil.
--    O post continua guardando bairro/cidade/UF de quem escreveu; `scope` diz
--    até onde ele circula. Região = macrorregião do IBGE, derivada da UF.
--    Moderação: bairro com o moderador do bairro (como antes); estado,
--    região e Brasil só com admin. Auto-aprovação de 2h vale só para bairro —
--    post para o Brasil inteiro nunca sai sem alguém ter olhado.
--
-- 2. Autor pode APAGAR o próprio post (editar, não). Admin também.
--
-- 3. `notifications`: aviso para a pessoa quando o post é publicado ou
--    removido, com o motivo escrito pela moderação. Só triggers gravam.

alter table posts add column if not exists scope text not null default 'bairro'
  check (scope in ('bairro', 'estado', 'regiao', 'brasil'));

/** Macrorregião do IBGE de uma UF. */
create or replace function public.region_of(p_uf text)
returns text language sql immutable set search_path = public as $$
  select case
    when p_uf in ('PR', 'SC', 'RS') then 'Sul'
    when p_uf in ('SP', 'RJ', 'MG', 'ES') then 'Sudeste'
    when p_uf in ('DF', 'GO', 'MT', 'MS') then 'Centro-Oeste'
    when p_uf in ('BA', 'SE', 'AL', 'PE', 'PB', 'RN', 'CE', 'PI', 'MA') then 'Nordeste'
    when p_uf in ('AM', 'PA', 'AC', 'RO', 'RR', 'AP', 'TO') then 'Norte'
  end;
$$;

create or replace function public.my_state() returns text
language sql stable security definer set search_path = public as $$
  select state from profiles where id = auth.uid();
$$;
revoke execute on function public.my_state() from public, anon;
grant execute on function public.my_state() to authenticated;

create index if not exists idx_posts_scope on posts (scope, status, state, created_at desc);

drop policy if exists posts_select_feed on posts;
create policy posts_select_feed on posts
  for select using (
    status = 'published'
    and public.is_militant_or_above()
    and (
      (scope = 'bairro' and (neighborhood, city) = (select neighborhood, city from public.my_area()))
      or (scope = 'estado' and state = public.my_state())
      or (scope = 'regiao' and public.region_of(state) = public.region_of(public.my_state()))
      or scope = 'brasil'
    )
  );

drop policy if exists posts_select_moderation on posts;
create policy posts_select_moderation on posts
  for select using (
    status in ('pending', 'flagged')
    and ((scope = 'bairro' and public.is_moderator_for(neighborhood, city)) or public.is_admin())
  );

drop policy if exists posts_insert_militant on posts;
create policy posts_insert_militant on posts
  for insert with check (
    public.is_militant_or_above()
    and author_id = auth.uid()
    and status = 'pending'
    and (neighborhood, city) = (select neighborhood, city from public.my_area())
    and state = public.my_state()
  );

drop policy if exists posts_update_moderator on posts;
create policy posts_update_moderator on posts
  for update using ((scope = 'bairro' and public.is_moderator_for(neighborhood, city)) or public.is_admin());

drop policy if exists posts_delete_author on posts;
create policy posts_delete_author on posts
  for delete using (author_id = auth.uid() or public.is_admin());
grant delete on posts to authenticated;

create or replace function public.auto_approve_posts() returns int
language sql security definer set search_path = public as $$
  with done as (
    update posts set status = 'published'
     where status = 'pending' and scope = 'bairro' and created_at < now() - interval '2 hours'
    returning 1
  )
  select count(*)::int from done;
$$;
revoke execute on function public.auto_approve_posts() from public, anon, authenticated;

-- View do feed passa a expor o nível.
create or replace view posts_with_author
with (security_invoker = true) as
select p.id, p.author_id, p.content, p.image_url, p.neighborhood, p.city,
       p.state, p.status, p.moderator_id, p.moderator_note, p.flagged_count,
       p.created_at,
       public.display_name_of(p.author_id) as author_display_name,
       p.scope
  from posts p;
revoke all on posts_with_author from anon;
revoke insert, update, delete on posts_with_author from authenticated;
grant select on posts_with_author to authenticated;

-- ------------------------------------------------------------ notificações

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  ref_id     uuid,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists idx_notifications_user on notifications (user_id, created_at desc);

alter table notifications enable row level security;
revoke all on notifications from public, anon, authenticated;
grant select on notifications to authenticated;
grant update (read_at) on notifications to authenticated;

drop policy if exists notifications_select_own on notifications;
create policy notifications_select_own on notifications for select using (user_id = auth.uid());
drop policy if exists notifications_update_own on notifications;
create policy notifications_update_own on notifications for update using (user_id = auth.uid());

/** Avisa o autor quando a moderação decide o post. */
create or replace function public.notify_post_decision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('published', 'removed') then
    insert into notifications (user_id, kind, title, body, ref_id)
    values (
      new.author_id,
      'post_' || new.status,
      case when new.status = 'published' then 'Seu post foi publicado' else 'Seu post não foi publicado' end,
      case when new.status = 'removed'
           then coalesce(nullif(btrim(new.moderator_note), ''), 'A moderação não informou o motivo.')
           else left(new.content, 120) end,
      new.id
    );
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_post_decision() from public, anon, authenticated;

drop trigger if exists trg_notify_post_decision on posts;
create trigger trg_notify_post_decision after update of status on posts
  for each row execute function public.notify_post_decision();
