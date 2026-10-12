-- Yvy — convite em duas etapas: escanear (reserva) e cadastrar (decisão de 12/10).
--
-- Antes o prazo do convite era conferido só no fim, em redeem_invite, depois
-- do formulário (ou do primeiro login, com "Confirm email" ligado). Por isso
-- o QRCode precisava valer 24h, e uma foto dele valia 24h também.
--
-- Agora:
--   1. Escanear: claim_invite(token) reserva uma vaga do convite e devolve um
--      segredo (`invite_claims.secret`) que fica só no celular de quem
--      escaneou. A janela de escaneamento é curta:
--        pessoal    2 min, 1 vaga
--        mesa       5 min por QRCode, que troca sozinho (rotate_table_invite);
--                   até 20 vagas e 4h no evento inteiro
--        distância  24h, 1 vaga (código de texto; a pessoa não está na frente)
--   2. Cadastrar: redeem_invite(p_claim, ...) com o segredo, em até 24h. O
--      token do QRCode sozinho não cria mais perfil.
--
-- claim_invite roda para `anon`: quem escaneia ainda não tem conta. É a única
-- coisa nova aberta a anon aqui (decisão explícita de 12/10); a função não lê
-- dado de ninguém e só reserva vaga de um token UUID que a pessoa já tem.
--
-- Prazos saem do relógio do servidor (trigger), não do celular: com janela de
-- 2 min, um aparelho com relógio 3 min adiantado geraria QRCode já vencido.

-- ------------------------------------------------------------
-- Tabela de reservas: sem acesso nenhum pela API, só pelas RPCs abaixo.
-- ------------------------------------------------------------
alter table invites add column if not exists scan_expires_at timestamptz;
update invites set scan_expires_at = expires_at where scan_expires_at is null;
alter table invites alter column scan_expires_at set not null;

create table if not exists invite_claims (
  id          uuid primary key default gen_random_uuid(),
  invite_id   uuid not null references invites(id) on delete cascade,
  secret      uuid unique not null default gen_random_uuid(),
  expires_at  timestamptz not null,
  redeemed_by uuid references profiles(id) on delete set null,
  redeemed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_invite_claims_invite on invite_claims (invite_id);

alter table invite_claims enable row level security;
revoke all on table invite_claims from public, anon, authenticated;

-- ------------------------------------------------------------
-- Prazos e vagas definidos pelo servidor na criação do convite.
-- BEFORE trigger roda antes do WITH CHECK da policy: a policy confere a linha
-- já ajustada.
-- ------------------------------------------------------------
create or replace function public.invites_set_windows() returns trigger
language plpgsql set search_path = public as $$
begin
  new.use_count := 0;
  new.used_by := null;
  if new.is_remote then
    new.max_uses := 1;
    new.expires_at := now() + interval '24 hours';
    new.scan_expires_at := new.expires_at;
  elsif new.is_table_qr then
    new.max_uses := least(greatest(coalesce(new.max_uses, 20), 1), 20);
    new.expires_at := now() + interval '4 hours';
    new.scan_expires_at := now() + interval '5 minutes';
  else
    new.max_uses := 1;
    new.expires_at := now() + interval '2 minutes';
    new.scan_expires_at := new.expires_at;
  end if;
  return new;
end;
$$;

drop trigger if exists invites_set_windows on invites;
create trigger invites_set_windows before insert on invites
  for each row execute function public.invites_set_windows();
revoke execute on function public.invites_set_windows() from public, anon, authenticated;

-- Policy de 0015 com os prazos novos (o trigger já força; a policy é a
-- segunda trava, caso o trigger seja removido por engano).
drop policy if exists invites_insert_militant on invites;
create policy invites_insert_militant on invites
  for insert with check (
    public.is_militant_or_above()
    and created_by = auth.uid()
    and use_count = 0
    and used_by is null
    and scan_expires_at > now()
    and (
      (not is_table_qr and not is_remote and max_uses = 1
        and expires_at <= now() + interval '3 minutes')
      or (is_table_qr and not is_remote and max_uses <= 20
        and expires_at <= now() + interval '4 hours 1 minute'
        and scan_expires_at <= now() + interval '6 minutes')
      or (is_remote and not is_table_qr and max_uses = 1
        and expires_at <= now() + interval '24 hours 1 minute'
        and public.my_role() in ('moderator', 'admin'))
    )
  );

-- ------------------------------------------------------------
-- claim_invite — etapa 1, na hora de escanear.
-- Vagas ocupadas = já cadastrados (use_count) + reservas vivas não usadas.
-- Reserva que vence sem cadastro devolve a vaga sozinha.
-- ------------------------------------------------------------
create or replace function public.claim_invite(p_token uuid)
returns table(claim uuid, claim_expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_invite invites;
  v_held int;
  v_secret uuid;
  v_until timestamptz := now() + interval '24 hours';
begin
  select * into v_invite from invites where token = p_token for update;

  if v_invite.id is null then
    raise exception 'Convite não encontrado.' using errcode = 'P0002';
  end if;
  if v_invite.scan_expires_at < now() or v_invite.expires_at < now() then
    raise exception 'Este QRCode expirou. Peça para gerar outro.' using errcode = 'P0003';
  end if;
  if auth.uid() is not null and v_invite.created_by = auth.uid() then
    raise exception 'Ninguém entra na base com o próprio convite.' using errcode = '42501';
  end if;

  select count(*) into v_held
    from invite_claims
   where invite_id = v_invite.id and redeemed_at is null and expires_at > now();
  if v_invite.use_count + v_held >= v_invite.max_uses then
    raise exception 'Este convite já foi utilizado.' using errcode = 'P0004';
  end if;

  insert into invite_claims (invite_id, expires_at)
  values (v_invite.id, v_until)
  returning secret into v_secret;

  return query select v_secret, v_until;
end;
$$;

revoke execute on function public.claim_invite(uuid) from public;
grant execute on function public.claim_invite(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- rotate_table_invite — QRCode de mesa troca a cada 5 min.
-- Mesma linha: as 20 vagas e as 4h valem para o evento inteiro. O token
-- antigo morre na hora; quem já reservou continua com a reserva.
-- ------------------------------------------------------------
create or replace function public.rotate_table_invite(p_invite uuid)
returns table(token uuid, scan_expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_invite invites;
begin
  select * into v_invite from invites i where i.id = p_invite for update;

  if v_invite.id is null or v_invite.created_by is distinct from auth.uid() then
    raise exception 'Convite não encontrado.' using errcode = 'P0002';
  end if;
  if not v_invite.is_table_qr then
    raise exception 'Só o QRCode de mesa é renovado.' using errcode = '22023';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'O convite deste evento acabou (4h). Gere outro.' using errcode = 'P0003';
  end if;

  return query
    update invites i
       set token = gen_random_uuid(),
           scan_expires_at = least(now() + interval '5 minutes', i.expires_at)
     where i.id = v_invite.id
    returning i.token, i.scan_expires_at;
end;
$$;

revoke execute on function public.rotate_table_invite(uuid) from public, anon;
grant execute on function public.rotate_table_invite(uuid) to authenticated;

-- ------------------------------------------------------------
-- redeem_invite — etapa 2, com o segredo da reserva.
-- A assinatura muda (p_token → p_claim): a versão antiga é removida pela
-- assinatura exata, senão ficaria como sobrecarga ainda executável — e
-- aceitaria o token do QRCode sem reserva.
-- Pedido de cadastro guardado no celular antes desta migration (esperando
-- confirmação de e-mail) falha de propósito: aceitar o token cru de novo
-- reabriria o atalho.
-- ------------------------------------------------------------
drop function if exists public.redeem_invite(uuid, text, text, text, text, text, text, text, integer);

create function public.redeem_invite(
  p_claim uuid, p_full_name text, p_display_name text, p_phone text default null,
  p_cep text default null, p_neighborhood text default null, p_city text default null,
  p_state text default null, p_location_precision integer default 3)
returns table(profile_id uuid, membership_status membership_status)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_claim invite_claims;
  v_invite invites;
begin
  if v_uid is null then
    raise exception 'Sessão ausente.' using errcode = '28000';
  end if;

  if exists (select 1 from profiles where id = v_uid) then
    raise exception 'Esta conta já tem perfil.' using errcode = '23505';
  end if;

  if p_display_name is null or p_display_name = '' or p_neighborhood is null then
    raise exception 'Dados de cadastro incompletos.' using errcode = '22023';
  end if;

  select * into v_claim from invite_claims where secret = p_claim for update;

  if v_claim.id is null then
    raise exception 'Convite não encontrado.' using errcode = 'P0002';
  end if;
  if v_claim.redeemed_at is not null then
    raise exception 'Este convite já foi utilizado.' using errcode = 'P0004';
  end if;
  -- Só a reserva tem prazo aqui (24h): o QRCode pode ter vencido há tempo,
  -- e tudo bem — a pessoa escaneou dentro da janela.
  if v_claim.expires_at < now() then
    raise exception 'A reserva do convite venceu (24h). Peça um QRCode novo.' using errcode = 'P0003';
  end if;

  select * into v_invite from invites where id = v_claim.invite_id for update;

  if v_invite.created_by = v_uid then
    raise exception 'Ninguém entra na base com o próprio convite.' using errcode = '42501';
  end if;

  insert into profiles (
    id, role, membership_status, full_name, display_name, phone, cep,
    neighborhood, city, state, location_precision, invited_by, terms_accepted_at
  ) values (
    v_uid, 'militant', 'pending', nullif(p_full_name, ''), p_display_name,
    nullif(p_phone, ''), nullif(p_cep, ''), p_neighborhood, p_city, p_state,
    coalesce(p_location_precision, 3), v_invite.created_by, now()
  );

  update invite_claims
     set redeemed_at = now(), redeemed_by = v_uid
   where id = v_claim.id;

  update invites
     set use_count = use_count + 1,
         used_by = case when max_uses = 1 then v_uid else used_by end
   where id = v_invite.id;

  insert into audit_log (user_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'redeem_invite', 'invite', v_invite.id,
          jsonb_build_object('invited_by', v_invite.created_by, 'table_qr', v_invite.is_table_qr));

  -- Só apelido e bairro, como em todo lugar entre pessoas.
  insert into notifications (user_id, kind, title, body, ref_id)
  values (v_invite.created_by, 'invitee_pending',
          p_display_name || ' entrou com seu convite',
          'Confirme ou recuse em Perfil → Convites aguardando você. Bairro: ' || p_neighborhood || '.',
          v_uid);

  return query select v_uid, 'pending'::membership_status;
end;
$$;

revoke execute on function public.redeem_invite(uuid, text, text, text, text, text, text, text, integer) from public, anon;
grant execute on function public.redeem_invite(uuid, text, text, text, text, text, text, text, integer) to authenticated;

-- ------------------------------------------------------------
-- Limpeza: reserva vencida há mais de 1 dia não serve para nada (o registro
-- de quem entrou fica em profiles.invited_by e no audit_log).
-- ------------------------------------------------------------
create or replace function public.purge_invite_claims() returns int
language sql security definer set search_path = public as $$
  with gone as (
    delete from invite_claims where expires_at < now() - interval '1 day' returning 1
  )
  select count(*)::int from gone;
$$;
revoke execute on function public.purge_invite_claims() from public, anon, authenticated;

select cron.schedule('purge-invite-claims', '15 4 * * *',
                     $$select public.purge_invite_claims()$$);
