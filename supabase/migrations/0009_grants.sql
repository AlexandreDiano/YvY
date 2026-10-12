-- Yvy — o que a API deixa chamar e escrever além das policies (funções e views).
--
-- Postgres dá EXECUTE a PUBLIC em toda função nova, e o Supabase ainda
-- concede a `anon` e `authenticated` explicitamente. Toda função em `public`
-- vira, portanto, `POST /rest/v1/rpc/<nome>` aberto a quem tem a anon key do
-- bundle. As rotinas de tempo abaixo não checam papel nenhum (rodam pelo
-- pg_cron): abertas, qualquer um publicaria a fila de moderação inteira com
-- uma chamada.

-- Rotinas de tempo: só pg_cron (postgres) e service_role.
revoke execute on function public.auto_approve_posts()    from public, anon, authenticated;
revoke execute on function public.auto_complete_actions() from public, anon, authenticated;
revoke execute on function public.purge_audit_log()       from public, anon, authenticated;

-- Sem sessão não há perfil: `anon` não tem o que fazer nestas.
-- NÃO revogar `is_admin()` de anon: as policies de proposal_cards e
-- fact_checks a chamam também na leitura pública.
revoke execute on function public.my_role()                                    from public, anon;
revoke execute on function public.is_militant_or_above()                       from public, anon;
revoke execute on function public.is_moderator_for(text, text)                 from public, anon;
revoke execute on function public.my_area()                                    from public, anon;
revoke execute on function public.display_name_of(uuid)                        from public, anon;
revoke execute on function public.participant_count(uuid)                      from public, anon;
revoke execute on function public.redeem_invite(uuid, text, text, text, text, text, text, text, int) from public, anon;
revoke execute on function public.build_pull_routes(text, text, text, int)     from public, anon;
revoke execute on function public.my_pending_invitees()                        from public, anon;
revoke execute on function public.decide_invitee(uuid, membership_status)      from public, anon;
revoke execute on function public.purge_pull_data()                            from public, anon;

-- `revoke from public` acima tirou o acesso implícito; devolve a quem tem sessão.
grant execute on function
  public.my_role(),
  public.is_militant_or_above(),
  public.is_moderator_for(text, text),
  public.my_area(),
  public.display_name_of(uuid),
  public.participant_count(uuid),
  public.redeem_invite(uuid, text, text, text, text, text, text, text, int),
  public.build_pull_routes(text, text, text, int),
  public.my_pending_invitees(),
  public.decide_invitee(uuid, membership_status),
  public.purge_pull_data()
to authenticated;

-- ============================================================
-- Views: só leitura.
--
-- O Supabase concede ALL a anon/authenticated em toda relação nova de
-- `public`, views inclusive. `profiles_public` é view simples (uma tabela, sem
-- agregação), logo auto-updatable, e roda com os privilégios do dono
-- (security_invoker = false), que ignora RLS. Com o grant padrão, qualquer
-- sessão faria `PATCH /profiles_public?id=eq.<eu> {"role":"admin"}`. O grant
-- por coluna de 0006 não pega isso: ele vale para `profiles`, não para a view.
-- ============================================================

revoke all on profiles_public, actions_with_counts, posts_with_author from anon, authenticated;
grant select on profiles_public, actions_with_counts, posts_with_author to authenticated;
