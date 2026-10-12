-- Yvy — agrupa feedback parecido ("X pessoas comentaram").
--
-- A Edge Function `feedback-group` (cron de hora em hora + botão da equipe)
-- manda ao Gemini os feedbacks ainda sem grupo e os títulos dos grupos que já
-- existem; ele diz em qual grupo cada um entra ou cria um novo. Só a equipe vê
-- os grupos. Cliente nenhum escreve group_id: só a função (service role).

create table if not exists feedback_groups (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 120),
  created_at  timestamptz not null default now()
);
alter table feedback_groups enable row level security;
revoke all on feedback_groups from public, anon, authenticated;
grant select on feedback_groups to authenticated;
drop policy if exists feedback_groups_staff on feedback_groups;
create policy feedback_groups_staff on feedback_groups for select using (public.is_staff());

alter table feedback add column if not exists group_id uuid references feedback_groups(id) on delete set null;
create index if not exists idx_feedback_ungrouped on feedback (created_at) where group_id is null;

-- Membro não escolhe grupo ao enviar (e não tem UPDATE em group_id: o grant
-- de 0029 é só status/staff_note).
drop policy if exists feedback_insert_own on feedback;
create policy feedback_insert_own on feedback for insert
  with check (author_id = auth.uid() and public.is_militant_or_above() and status = 'novo'
              and staff_note is null and group_id is null);

-- f.* foi expandido quando a view nasceu: recria para entrar group_id.
drop view if exists feedback_with_author;
create view feedback_with_author
with (security_invoker = true) as
select f.*, public.display_name_of(f.author_id) as author_display_name, g.title as group_title
  from feedback f
  left join feedback_groups g on g.id = f.group_id;
revoke all on feedback_with_author from public, anon;
revoke insert, update, delete on feedback_with_author from authenticated;
grant select on feedback_with_author to authenticated;

select cron.schedule('feedback-group', '7 * * * *', $$
  select net.http_post(
    url     := 'https://qbxdoprekyynzcwdtvuw.supabase.co/functions/v1/feedback-group',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'claim_cron_key')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000)
  where exists (select 1 from public.feedback where group_id is null);
$$);
