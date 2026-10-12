-- Yvy — ideias, problemas e sugestões dos membros para a equipe.
--
-- Membro envia e vê só os próprios; moderador e admin veem todos e marcam
-- a situação. Ninguém edita a mensagem depois de enviada.

create table if not exists feedback (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references profiles(id) on delete cascade,
  kind        text not null check (kind in ('ideia', 'problema', 'outro')),
  message     text not null check (char_length(message) between 5 and 1000),
  status      text not null default 'novo' check (status in ('novo', 'visto', 'feito', 'descartado')),
  staff_note  text check (staff_note is null or char_length(staff_note) <= 500),
  created_at  timestamptz not null default now()
);
create index if not exists idx_feedback_status on feedback (status, created_at desc);

alter table feedback enable row level security;
revoke all on feedback from public, anon, authenticated;
grant select, insert on feedback to authenticated;
grant update (status, staff_note) on feedback to authenticated;

drop policy if exists feedback_insert_own on feedback;
create policy feedback_insert_own on feedback for insert
  with check (author_id = auth.uid() and public.is_militant_or_above() and status = 'novo' and staff_note is null);

drop policy if exists feedback_select on feedback;
create policy feedback_select on feedback for select
  using (author_id = auth.uid() or public.is_staff());

drop policy if exists feedback_update_staff on feedback;
create policy feedback_update_staff on feedback for update using (public.is_staff());

/** Apelido de quem mandou, para a equipe (não expõe outros dados). */
create or replace view feedback_with_author
with (security_invoker = true) as
select f.*, public.display_name_of(f.author_id) as author_display_name
  from feedback f;
revoke all on feedback_with_author from anon;
revoke insert, update, delete on feedback_with_author from authenticated;
grant select on feedback_with_author to authenticated;
