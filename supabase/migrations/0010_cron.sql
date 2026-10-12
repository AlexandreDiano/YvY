-- Yvy — agendamento das rotinas de tempo (pg_cron).
--
-- O expurgo da puxada (purge_pull_data) NÃO é agendado de propósito: é um ato
-- consciente da coordenação depois da apuração. Ver 0007_retention.sql.

create extension if not exists pg_cron with schema pg_catalog;

-- Post sem resposta da moderação em 2h publica sozinho (fluxo 4.4).
select cron.schedule('auto-approve-posts', '*/10 * * * *',
                     $$select public.auto_approve_posts()$$);

-- Ação vira 'completed' 2h depois do horário (fluxo 4.3).
select cron.schedule('auto-complete-actions', '0 * * * *',
                     $$select public.auto_complete_actions()$$);

-- audit_log: retenção de 90 dias (seção 5.3).
select cron.schedule('purge-audit', '0 4 * * *',
                     $$select public.purge_audit_log()$$);
