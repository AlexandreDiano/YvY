-- Yvy — avisos por e-mail (decisão de 18/10).
--
-- O PWA não tem push. Quem liga "Avisos por e-mail" no Perfil recebe por
-- e-mail os avisos que já iam para a tela Avisos. O app preenche o padrão na
-- primeira abertura: ligado no site/PWA, desligado no APK (que tem
-- notificação no aparelho). Null = ainda não escolhido = não manda.
--
-- Quem manda é a Edge Function notify-email, chamada pelo pg_cron a cada
-- 5 min só quando tem aviso esperando. Aviso já lido no app ou com mais de
-- 1 dia não vai por e-mail. Envio pelo Resend; a chave fica na função, não aqui.

alter table profiles add column if not exists notify_email boolean;
grant update (notify_email) on profiles to authenticated;

alter table notifications add column if not exists emailed_at timestamptz;
create index if not exists idx_notifications_email_queue
  on notifications (created_at) where emailed_at is null;

select cron.schedule('notify-email', '*/5 * * * *', $$
  select net.http_post(
    url     := 'https://qbxdoprekyynzcwdtvuw.supabase.co/functions/v1/notify-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'claim_cron_key')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000)
  where exists (
    select 1 from public.notifications n
      join public.profiles p on p.id = n.user_id
     where n.emailed_at is null and n.read_at is null
       and n.created_at > now() - interval '1 day'
       and p.notify_email and p.is_active);
$$);
