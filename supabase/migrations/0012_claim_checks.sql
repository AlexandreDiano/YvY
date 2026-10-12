-- Yvy — checagem automática sob demanda, em fila.
--
-- Quem cola um texto que a base editorial (fact_checks) não cobre entra numa
-- fila. A Edge Function `process-claim-checks`, chamada pelo pg_cron, checa
-- um lote por vez com IA + busca na web e guarda o resultado aqui. Quem pedir
-- o mesmo texto depois recebe o que já está guardado, sem custo novo.
--
-- Separado de fact_checks de propósito: aquilo é conteúdo editorial revisado;
-- isto é automático e sai sempre rotulado como tal. Promover para fact_checks
-- é decisão da equipe (ver promote_claim_check abaixo).
--
-- Dado pessoal: gente cola mensagem inteira de WhatsApp, com nome e telefone.
--   * o texto colado é guardado já com telefone, e-mail e CPF removidos;
--   * depois de checado, o texto colado é APAGADO e fica só a afirmação neutra
--     que a IA extraiu (`claim_text`), que é o que outras pessoas veem.

create extension if not exists pg_net with schema extensions;

create type claim_status as enum ('queued', 'processing', 'done', 'failed');

create table claim_checks (
  id              uuid primary key default gen_random_uuid(),
  -- sha256 do texto normalizado e sem dado pessoal: mesma mensagem = mesma linha.
  -- Hash exato, não similaridade: "X vai cortar" e "X não vai cortar" são
  -- parecidos em trigrama e têm veredito oposto.
  input_hash      text not null unique,
  input_text      text,                      -- apagado depois da checagem
  claim_text      text,                      -- afirmação neutra extraída pela IA
  status          claim_status not null default 'queued',
  result          check_result,
  explanation     text,
  source_name     text,
  source_url      text,
  model           text,
  attempts        int not null default 0,
  requested_count int not null default 1,
  error           text,
  created_at      timestamptz not null default now(),
  queued_at       timestamptz not null default now(),
  checked_at      timestamptz
);

create index idx_claim_checks_queue on claim_checks (queued_at) where status = 'queued';

-- Fechada: nenhum papel da API lê ou escreve direto. Só as funções abaixo.
alter table claim_checks enable row level security;
revoke all on claim_checks from public, anon, authenticated;

/** Remove telefone, e-mail e CPF antes de guardar qualquer coisa. */
create or replace function public.redact_pii(t text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(t,
               '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', '[e-mail]', 'g'),
             '\d{3}\.?\d{3}\.?\d{3}-?\d{2}', '[cpf]', 'g'),
           '(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}', '[telefone]', 'g');
$$;

/** Forma pública de uma checagem: nunca expõe o texto colado. */
create or replace function public.claim_check_view(c claim_checks)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', c.id,
    'status', c.status,
    'claim_text', c.claim_text,
    'result', c.result,
    'explanation', c.explanation,
    'source_name', c.source_name,
    'source_url', c.source_url,
    'checked_at', c.checked_at
  );
$$;

/**
 * Pede a checagem de um texto. Devolve o resultado guardado quando existe e
 * está dentro da validade (7 dias: político muda de fala, notícia muda); senão
 * põe na fila. Aberta a anon: visitante também pede.
 *
 * Teto global de entradas novas por dia — o custo por checagem é real e não
 * dá para limitar por pessoa sem guardar IP. Fila cheia = resposta clara.
 */
create or replace function public.request_claim_check(p_text text)
returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_clean text := left(btrim(redact_pii(coalesce(p_text, ''))), 2000);
  v_norm  text := lower(regexp_replace(v_clean, '\s+', ' ', 'g'));
  v_hash  text := encode(digest(v_norm, 'sha256'), 'hex');
  v_row   claim_checks;
  v_today int;
begin
  if length(v_norm) < 8 then
    raise exception 'Texto curto demais para checar.';
  end if;

  select * into v_row from claim_checks where input_hash = v_hash for update;

  if found then
    if v_row.status = 'done' and v_row.checked_at > now() - interval '7 days' then
      update claim_checks set requested_count = requested_count + 1 where id = v_row.id;
      return claim_check_view(v_row);
    end if;
    if v_row.status in ('queued', 'processing') then
      update claim_checks set requested_count = requested_count + 1 where id = v_row.id;
      return claim_check_view(v_row);
    end if;
    -- vencida ou falhou: volta para a fila. O texto colado já foi apagado,
    -- então guarda de novo o que acabou de chegar (já sem dado pessoal).
    update claim_checks
       set status = 'queued', input_text = v_clean, queued_at = now(),
           requested_count = requested_count + 1, attempts = 0, error = null
     where id = v_row.id
     returning * into v_row;
    return claim_check_view(v_row);
  end if;

  select count(*) into v_today from claim_checks where created_at > now() - interval '1 day';
  if v_today >= 150 then
    raise exception 'A fila de checagem está cheia hoje. Tente amanhã ou mande para a equipe do seu bairro.';
  end if;

  insert into claim_checks (input_hash, input_text)
  values (v_hash, v_clean)
  on conflict (input_hash) do update set requested_count = claim_checks.requested_count + 1
  returning * into v_row;
  return claim_check_view(v_row);
end;
$$;

/** Situação das checagens que este aparelho pediu (ids guardados localmente). */
create or replace function public.get_claim_checks(p_ids uuid[])
returns setof jsonb
language sql stable security definer set search_path = public as $$
  select claim_check_view(c) from claim_checks c where c.id = any(p_ids[1:50]);
$$;

/**
 * Lote para a Edge Function. Marca como 'processing' com SKIP LOCKED para
 * duas execuções simultâneas não pegarem o mesmo item. Item preso em
 * 'processing' há mais de 30 min (função caiu no meio) volta a valer.
 */
create or replace function public.claim_next_checks(p_limit int default 5)
returns setof claim_checks
language sql volatile security definer set search_path = public as $$
  update claim_checks c
     set status = 'processing', attempts = c.attempts + 1, queued_at = now()
   where c.id in (
     select id from claim_checks
      where (status = 'queued'
             or (status = 'processing' and queued_at < now() - interval '30 minutes'))
        and attempts < 3
      order by queued_at
      limit least(p_limit, 20)
      for update skip locked)
  returning c.*;
$$;

/** Grava o resultado e apaga o texto colado. */
create or replace function public.finish_claim_check(
  p_id uuid, p_claim text, p_result check_result, p_explanation text,
  p_source_name text, p_source_url text, p_model text)
returns void
language sql volatile security definer set search_path = public as $$
  update claim_checks
     set status = 'done', claim_text = redact_pii(p_claim), result = p_result,
         explanation = redact_pii(p_explanation), source_name = p_source_name,
         source_url = p_source_url, model = p_model, input_text = null,
         checked_at = now(), error = null
   where id = p_id;
$$;

create or replace function public.fail_claim_check(p_id uuid, p_error text)
returns void
language sql volatile security definer set search_path = public as $$
  update claim_checks
     set status = case when attempts >= 3 then 'failed'::claim_status else 'queued'::claim_status end,
         error = left(p_error, 500)
   where id = p_id;
$$;

/**
 * Equipe editorial revisou e aprova: vira checagem oficial em fact_checks.
 * Só admin (pelo SQL Editor ou pelo app no futuro).
 */
create or replace function public.promote_claim_check(p_id uuid)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_row claim_checks;
  v_id  uuid;
begin
  if not is_admin() then
    raise exception 'Só admin promove checagem.';
  end if;
  select * into v_row from claim_checks where id = p_id and status = 'done';
  if not found then
    raise exception 'Checagem não encontrada ou não concluída.';
  end if;
  insert into fact_checks (claim_text, result, explanation, source_url, source_name)
  values (v_row.claim_text, v_row.result, v_row.explanation, v_row.source_url, v_row.source_name)
  returning id into v_id;
  return v_id;
end;
$$;

-- Grants (padrão de 0009): Supabase dá EXECUTE a todo mundo em função nova.
revoke execute on function public.redact_pii(text)                    from public, anon, authenticated;
revoke execute on function public.claim_check_view(claim_checks)      from public, anon, authenticated;
revoke execute on function public.claim_next_checks(int)              from public, anon, authenticated;
revoke execute on function public.finish_claim_check(uuid, text, check_result, text, text, text, text)
                                                                       from public, anon, authenticated;
revoke execute on function public.fail_claim_check(uuid, text)        from public, anon, authenticated;
revoke execute on function public.promote_claim_check(uuid)           from public, anon;
revoke execute on function public.request_claim_check(text)           from public;
revoke execute on function public.get_claim_checks(uuid[])            from public;
grant  execute on function public.request_claim_check(text)           to anon, authenticated;
grant  execute on function public.get_claim_checks(uuid[])            to anon, authenticated;
grant  execute on function public.claim_next_checks(int)              to service_role;
grant  execute on function public.finish_claim_check(uuid, text, check_result, text, text, text, text)
                                                                       to service_role;
grant  execute on function public.fail_claim_check(uuid, text)        to service_role;

-- A cada 15 min a Edge Function processa um lote (até 5). O segredo que ela
-- confere fica no Vault (`claim_cron_key`), nunca neste arquivo.
select cron.schedule('process-claim-checks', '*/15 * * * *', $$
  select net.http_post(
    url     := 'https://qbxdoprekyynzcwdtvuw.supabase.co/functions/v1/process-claim-checks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'claim_cron_key')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000)
  where exists (select 1 from public.claim_checks where status = 'queued');
$$);
