-- rls_auto_enable() não nasceu de migration: veio da opção do painel que liga
-- a RLS sozinha em tabela nova (event trigger ensure_rls, ddl_command_end).
-- O Supabase deu EXECUTE a anon e authenticated, como faz com toda função de
-- public, e isso fura a lista fechada do anon (supabase/tests/invariants.sql).
--
-- Chamada pela API só dá erro (função de event trigger), mas porta que ninguém
-- decidiu abrir fica fechada. O event trigger continua funcionando: o Postgres
-- não confere EXECUTE quando o trigger dispara.
--
-- Banco local e CI não têm a função; aí não faz nada.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
