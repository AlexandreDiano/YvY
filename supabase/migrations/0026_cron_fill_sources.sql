-- Yvy — uma vez por dia, a Edge Function procura o link da fonte do conteúdo
-- da equipe (checagens e propostas) que ainda está sem link. Só age se
-- existir item sem link; cada item custa 1 busca no Tavily.

select cron.schedule('fill-editorial-sources', '30 5 * * *', $$
  select net.http_post(
    url     := 'https://qbxdoprekyynzcwdtvuw.supabase.co/functions/v1/process-claim-checks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'claim_cron_key')),
    body    := '{"fill_sources": true}'::jsonb,
    timeout_milliseconds := 120000)
  where exists (select 1 from public.fact_checks where source_url is null)
     or exists (select 1 from public.proposal_cards where source_url is null);
$$);
