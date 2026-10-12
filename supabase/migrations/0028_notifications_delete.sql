-- Yvy — a pessoa pode apagar os próprios avisos (um a um ou todos).

grant delete on notifications to authenticated;
drop policy if exists notifications_delete_own on notifications;
create policy notifications_delete_own on notifications for delete using (user_id = auth.uid());
