-- Yvy — log de auditoria de tudo que cada usuário faz (decisão de 18/10).
--
-- Antes o audit_log guardava só ações-chave (moderar, mudar papel, convite)
-- por 90 dias. Agora:
--   - toda criação, alteração e exclusão feita por usuário logado, em toda
--     tabela de public, entra no log com o conteúdo (linha nova; na
--     alteração, só os campos que mudaram, antes e depois; na exclusão, a
--     linha que saiu). Serve de prova do que estava escrito antes de alguém
--     apagar;
--   - login e logout (auth.sessions), com IP e aparelho;
--   - IP de quem fez (cf-connecting-ip, ver request_ip em 0037);
--   - apelido de quem fez no momento da ação, e o log não perde o autor
--     quando a conta é apagada (sem FK para profiles);
--   - retenção de 6 meses (Marco Civil, art. 15, para registro de acesso).
--
-- Fica de fora, de propósito:
--   - escrita sem usuário logado (pg_cron, Edge Function com service role,
--     claim_invite de quem ainda não tem conta: 0037 promete não guardar IP
--     cru de quem escaneia);
--   - claim_checks: a política promete apagar o texto colado na checagem;
--   - notifications: é efeito de outra ação, que já está no log;
--   - municipios e elected_2026: dado público carregado por script;
--   - colunas que são segredo (token do convite, segredo da reserva) e o
--     IP do convite (já fica na coluna própria do log).
--
-- Tabela nova em public não entra sozinha: chamar
--   select public.audit_attach('nome_da_tabela');
-- na migration que criar a tabela.
--
-- Leitura: só admin (policy audit_select_admin, 0006). Cliente não grava.

-- ------------------------------------------------------------
-- Autor sobrevive à exclusão da conta
-- ------------------------------------------------------------
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.audit_log'::regclass and contype = 'f';
  if c is not null then
    execute format('alter table public.audit_log drop constraint %I', c);
  end if;
end $$;

alter table audit_log add column if not exists actor_name text;
alter table audit_log add column if not exists user_agent text;
create index if not exists idx_audit_entity on audit_log (entity_type, entity_id, created_at desc);
create index if not exists idx_audit_created on audit_log (created_at);

/** IP da requisição como inet; cabeçalho torto vira null em vez de derrubar a escrita. */
create or replace function public.request_inet() returns inet
language plpgsql stable set search_path = public as $$
begin
  return public.request_ip()::inet;
exception when others then
  return null;
end;
$$;
revoke execute on function public.request_inet() from public, anon, authenticated;

-- ------------------------------------------------------------
-- Trigger genérico
-- ------------------------------------------------------------
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_hide text[] := array['token', 'secret', 'net_bucket', 'created_ip'];
  v_old jsonb;
  v_new jsonb;
  v_meta jsonb;
  v_id text;
  v_headers json;
begin
  if v_uid is null then
    return null;
  end if;

  if tg_op <> 'INSERT' then v_old := to_jsonb(old) - v_hide; end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new) - v_hide; end if;

  if tg_op = 'UPDATE' then
    -- só o que mudou, antes e depois
    select jsonb_object_agg(n.key, n.value), jsonb_object_agg(n.key, v_old -> n.key)
      into v_new, v_old
      from jsonb_each(v_new) n
     where n.value is distinct from v_old -> n.key;
    if v_new is null then
      return null;
    end if;
    v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');
  else
    v_id := coalesce(v_new, v_old) ->> 'id';
  end if;

  v_meta := jsonb_strip_nulls(jsonb_build_object('old', v_old, 'new', v_new));
  -- tabela sem id uuid (chave composta): a linha inteira já está em metadata
  if v_id !~ '^[0-9a-f-]{36}$' then
    v_id := null;
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;

  -- sem cf-connecting-ip, guarda a cadeia x-forwarded-for crua: o primeiro
  -- item pode ser forjado, mas o IP real que o Supabase acrescenta está nela
  if public.request_inet() is null and v_headers ->> 'x-forwarded-for' is not null then
    v_meta := v_meta || jsonb_build_object('xff', left(v_headers ->> 'x-forwarded-for', 200));
  end if;

  insert into audit_log (user_id, actor_name, action, entity_type, entity_id, metadata, ip_address, user_agent)
  values (v_uid,
          (select display_name from profiles where id = v_uid),
          lower(tg_op),
          tg_table_name,
          v_id::uuid,
          v_meta,
          public.request_inet(),
          left(v_headers ->> 'user-agent', 300));
  return null;
exception when others then
  -- em período eleitoral o app não pode parar por causa do log; o aviso
  -- aparece nos logs do Postgres no painel do Supabase
  raise warning 'audit_row falhou em %: %', tg_table_name, sqlerrm;
  return null;
end;
$$;
revoke execute on function public.audit_row() from public, anon, authenticated;

/** Liga o log numa tabela de public. Rodar de novo não duplica. */
create or replace function public.audit_attach(p_table text) returns void
language plpgsql security definer set search_path = public as $$
begin
  execute format('drop trigger if exists zz_audit_row on public.%I', p_table);
  execute format(
    'create trigger zz_audit_row after insert or update or delete on public.%I
       for each row execute function public.audit_row()', p_table);
end;
$$;
revoke execute on function public.audit_attach(text) from public, anon, authenticated;

do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
     where schemaname = 'public'
       and tablename not in ('audit_log', 'claim_checks', 'notifications', 'municipios', 'elected_2026')
  loop
    perform public.audit_attach(t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Login e logout
-- ------------------------------------------------------------
create or replace function public.audit_session() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s jsonb := to_jsonb(coalesce(new, old));
begin
  insert into audit_log (user_id, actor_name, action, entity_type, entity_id, ip_address, user_agent)
  values ((s ->> 'user_id')::uuid,
          (select display_name from profiles where id = (s ->> 'user_id')::uuid),
          case when tg_op = 'INSERT' then 'login' else 'logout' end,
          'session',
          (s ->> 'id')::uuid,
          case when s ->> 'ip' is not null then (s ->> 'ip')::inet end,
          left(s ->> 'user_agent', 300));
  return null;
exception when others then
  -- log nunca impede alguém de entrar ou sair
  return null;
end;
$$;
revoke execute on function public.audit_session() from public, anon, authenticated;

do $$
begin
  drop trigger if exists zz_audit_session on auth.sessions;
  create trigger zz_audit_session after insert or delete on auth.sessions
    for each row execute function public.audit_session();
exception when insufficient_privilege then
  raise warning 'Sem permissão para trigger em auth.sessions: login/logout fora do log.';
end $$;

-- ------------------------------------------------------------
-- Retenção: 6 meses
-- ------------------------------------------------------------
create or replace function public.purge_audit_log() returns int
language sql security definer set search_path = public as $$
  with gone as (
    delete from audit_log where created_at < now() - interval '6 months' returning 1
  )
  select count(*)::int from gone;
$$;
revoke execute on function public.purge_audit_log() from public, anon, authenticated;
