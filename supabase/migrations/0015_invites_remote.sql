-- Yvy — convite à distância e limites do convite garantidos no banco.
--
-- 1. Convite à distância (decisão de 11/10): código de texto para mandar a
--    quem está em outro estado. Só moderador ou admin gera. Mesmas regras do
--    pessoal: 1 uso, 24h, e quem gerou ainda confirma a pessoa
--    (decide_invitee). Militante comum continua só com QRCode presencial.
--
-- 2. Furo corrigido: a policy antiga só checava papel e autor. Com a anon key
--    do bundle, qualquer militante criava convite de 20 usos valendo anos, ou
--    com use_count negativo (= usos infinitos). Os limites que o app aplica
--    agora valem no banco:
--      pessoal   1 uso,  até 24h
--      mesa      até 20 usos, até 4h
--      distância 1 uso,  até 24h, só moderador/admin

alter table invites add column if not exists is_remote boolean not null default false;

drop policy if exists invites_insert_militant on invites;

create policy invites_insert_militant on invites
  for insert with check (
    public.is_militant_or_above()
    and created_by = auth.uid()
    and use_count = 0
    and used_by is null
    and expires_at > now()
    and expires_at <= now() + interval '24 hours 5 minutes'
    and (
      (not is_table_qr and not is_remote and max_uses = 1)
      or (is_table_qr and not is_remote and max_uses <= 20
          and expires_at <= now() + interval '4 hours 5 minutes')
      or (is_remote and not is_table_qr and max_uses = 1
          and public.my_role() in ('moderator', 'admin'))
    )
  );
