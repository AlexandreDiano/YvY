-- Yvy — segredo da chamada pg_cron -> Edge Function process-claim-checks.
--
-- Gerado aleatório dentro do Vault (nunca aparece em arquivo nem no app). A
-- função confere o cabeçalho `x-cron-key` chamando check_claim_cron_key com a
-- service role; assim não há segredo para copiar à mão entre Vault e painel.

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'claim_cron_key', 'Chamada do pg_cron para a Edge Function process-claim-checks')
 where not exists (select 1 from vault.secrets where name = 'claim_cron_key');

create or replace function public.check_claim_cron_key(p_key text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_key = (select decrypted_secret from vault.decrypted_secrets where name = 'claim_cron_key'), false);
$$;

revoke execute on function public.check_claim_cron_key(text) from public, anon, authenticated;
grant  execute on function public.check_claim_cron_key(text) to service_role;
