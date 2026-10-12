-- Yvy — funções de trigger fora da API.
--
-- Postgres não deixa chamar função `returns trigger` fora de trigger, então
-- `rpc/<nome>` já falharia. Revogar mesmo assim tira o ruído do linter de
-- segurança do Supabase e deixa a lista de RPCs igual à lista do que o app usa.
-- Trigger não precisa de EXECUTE do chamador para disparar.

revoke execute on function public.cascade_inviter_deactivation() from public, anon, authenticated;
revoke execute on function public.audit_post_moderation()        from public, anon, authenticated;
revoke execute on function public.audit_role_change()            from public, anon, authenticated;
revoke execute on function public.bump_flag_count()              from public, anon, authenticated;
revoke execute on function public.touch_updated_at()             from public, anon, authenticated;
