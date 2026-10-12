-- Yvy — fila de checagem: item preso em 'processing' não fica preso para sempre.
--
-- Se a Edge Function morre no meio (limite de tempo da plataforma),
-- fail_claim_check nunca roda e o item ficaria em 'processing'. Agora:
--   * claim_next_checks marca como 'failed' o que está preso há 30 min e já
--     esgotou as 3 tentativas, e retoma o que ainda tem tentativa;
--   * request_claim_check trata 'processing' velho como falha e põe na fila;
--   * o cron também dispara quando só há item preso.
--
-- ATENÇÃO: o cron abaixo (e o de 0012) aponta para a função DESTE projeto
-- (qbxdoprekyynzcwdtvuw). Em projeto de teste, trocar a URL antes de aplicar.

create or replace function public.claim_next_checks(p_limit int default 5)
returns setof claim_checks
language plpgsql volatile security definer set search_path = public as $$
begin
  update claim_checks
     set status = 'failed', error = coalesce(error, 'tempo esgotado no processamento')
   where status = 'processing' and queued_at < now() - interval '30 minutes' and attempts >= 3;

  return query
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
end;
$$;

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
    if v_row.status = 'queued'
       or (v_row.status = 'processing' and v_row.queued_at > now() - interval '30 minutes') then
      update claim_checks set requested_count = requested_count + 1 where id = v_row.id;
      return claim_check_view(v_row);
    end if;
    -- vencida, falhou ou presa: volta para a fila com o texto que acabou de chegar
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

revoke execute on function public.claim_next_checks(int) from public, anon, authenticated;
grant  execute on function public.claim_next_checks(int) to service_role;
revoke execute on function public.request_claim_check(text) from public;
grant  execute on function public.request_claim_check(text) to anon, authenticated;

select cron.unschedule('process-claim-checks');
select cron.schedule('process-claim-checks', '*/15 * * * *', $$
  select net.http_post(
    url     := 'https://qbxdoprekyynzcwdtvuw.supabase.co/functions/v1/process-claim-checks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'claim_cron_key')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000)
  where exists (select 1 from public.claim_checks
                 where status = 'queued'
                    or (status = 'processing' and queued_at < now() - interval '30 minutes'));
$$);
