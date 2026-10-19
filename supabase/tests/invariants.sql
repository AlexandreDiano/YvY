-- Regras do banco que só existiam por escrito, agora conferidas. Roda no
-- banco local depois das migrations (scripts/test-rls-local.sh). Qualquer
-- violação vira erro e derruba o teste.

do $$
declare
  v text;
begin
  -- 1. O que anon alcança. Abrir algo novo a visitante é decisão explícita:
  --    entra aqui junto com a migration que concede.
  select string_agg(table_name, ', ' order by table_name) into v
    from (select distinct table_name from information_schema.role_table_grants
           where grantee = 'anon' and table_schema = 'public'
             and table_name not in ('proposal_cards', 'fact_checks', 'feature_flags',
                                    'elected_2026', 'government_plans')) t;
  if v is not null then
    raise exception 'anon tem acesso a tabela/view fora da lista: %', v;
  end if;

  select string_agg(distinct p.proname, ', ') into v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('request_claim_check', 'get_claim_checks', 'cancel_claim_request',
                           'claim_invite', 'search_fact_checks', 'get_plain_texts',
                           -- usada nas policies; para anon só devolve false
                           'is_admin');
  if v is not null then
    raise exception 'anon executa função fora da lista: %', v;
  end if;

  -- 2. Toda tabela de public passa pela auditoria (0048), menos as de fora
  --    por decisão: o próprio log, fila de IA, avisos e dado de script.
  select string_agg(c.relname, ', ') into v
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p')
     and c.relname not in ('audit_log', 'claim_checks', 'notifications',
                           'elected_2026', 'municipios')
     and not exists (select 1 from pg_trigger t
                      where t.tgrelid = c.oid and t.tgname = 'zz_audit_row');
  if v is not null then
    raise exception 'tabela sem auditoria (falta audit_attach): %', v;
  end if;

  -- 3. Tabela de public sem RLS ligada é tabela aberta pela anon key.
  select string_agg(c.relname, ', ') into v
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  if v is not null then
    raise exception 'tabela sem RLS: %', v;
  end if;

  -- 4. profiles não tem policy de INSERT: perfil só nasce por redeem_invite.
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'profiles'
                and cmd in ('INSERT', 'ALL')) then
    raise exception 'profiles ganhou policy de INSERT';
  end if;

  -- 5. Colunas de papel não se editam pelo cliente (grant por coluna, 0006).
  select string_agg(column_name, ', ') into v
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'profiles'
     and grantee in ('authenticated', 'anon') and privilege_type in ('UPDATE', 'INSERT')
     and column_name in ('role', 'membership_status', 'is_active', 'invited_by',
                         'sensitive_consent_at');
  if v is not null then
    raise exception 'cliente pode escrever coluna protegida de profiles: %', v;
  end if;

  -- 6. Ninguém de fora grava no audit_log.
  if has_table_privilege('authenticated', 'public.audit_log', 'insert')
     or has_table_privilege('anon', 'public.audit_log', 'insert') then
    raise exception 'audit_log aceita insert de cliente';
  end if;
end $$;

select 'invariantes do banco ok' as resultado;
