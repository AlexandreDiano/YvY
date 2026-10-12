-- Yvy — ajustes da revisão jurídica preliminar (12/10/2026).
--
-- 1. Puxada desligada de verdade: com `module_puxada` desligado, o BANCO
--    recusa cadastro de eleitor. Esconder a aba não basta — a anon key está
--    no bundle e qualquer sessão logada poderia inserir direto pela API.
--    Arregimentação de eleitor é o ponto de maior risco (Lei 9.504/97, art.
--    39, §5º); o módulo só volta com liberação do advogado eleitoral.
--
-- 2. Consentimento para dado sensível (LGPD, arts. 5º, II e 11): fazer parte
--    de um grupo de organização política revela opinião política. O aceite
--    genérico dos termos não basta; o cadastro agora exige um consentimento
--    separado e explícito, guardado com data em `profiles.sensitive_consent_at`.
--    Quem já tinha conta dá o consentimento pelo app (`give_sensitive_consent`).

-- ---------------------------------------------------------------- 1. puxada

create or replace function public.voters_require_module() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce((select is_enabled from feature_flags where key = 'module_puxada'), false) then
    raise exception 'O cadastro de eleitores está desligado.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.voters_require_module() from public, anon, authenticated;

drop trigger if exists voters_require_module on voters;
create trigger voters_require_module before insert on voters
  for each row execute function public.voters_require_module();

-- ---------------------------------------------------------------- 2. consentimento

alter table profiles add column if not exists sensitive_consent_at timestamptz;

/** Membro que entrou antes desta migration consente pelo app. */
create or replace function public.give_sensitive_consent() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão ausente.' using errcode = '28000';
  end if;
  update profiles set sensitive_consent_at = coalesce(sensitive_consent_at, now()) where id = auth.uid();
  insert into audit_log (user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'sensitive_consent', 'profile', auth.uid(), '{}'::jsonb);
end;
$$;
revoke execute on function public.give_sensitive_consent() from public, anon;
grant execute on function public.give_sensitive_consent() to authenticated;

-- redeem_invite (0035) ganha o consentimento como parâmetro obrigatório.
-- Assinatura muda: remove a antiga pela assinatura exata (senão sobra como
-- sobrecarga que cadastra sem consentimento).
drop function if exists public.redeem_invite(uuid, text, text, text, text, text, text, text, integer);

create function public.redeem_invite(
  p_claim uuid, p_full_name text, p_display_name text, p_phone text default null,
  p_cep text default null, p_neighborhood text default null, p_city text default null,
  p_state text default null, p_location_precision integer default 3,
  p_sensitive_consent boolean default false)
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

  if not coalesce(p_sensitive_consent, false) then
    raise exception 'É preciso consentir com o tratamento do dado de participação política.' using errcode = '22023';
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
  if v_claim.expires_at < now() then
    raise exception 'A reserva do convite venceu (24h). Peça um QRCode novo.' using errcode = 'P0003';
  end if;

  select * into v_invite from invites where id = v_claim.invite_id for update;

  if v_invite.created_by = v_uid then
    raise exception 'Ninguém entra na base com o próprio convite.' using errcode = '42501';
  end if;

  insert into profiles (
    id, role, membership_status, full_name, display_name, phone, cep,
    neighborhood, city, state, location_precision, invited_by, terms_accepted_at,
    sensitive_consent_at
  ) values (
    v_uid, 'militant', 'pending', nullif(p_full_name, ''), p_display_name,
    nullif(p_phone, ''), nullif(p_cep, ''), p_neighborhood, p_city, p_state,
    coalesce(p_location_precision, 3), v_invite.created_by, now(), now()
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
          jsonb_build_object('invited_by', v_invite.created_by, 'table_qr', v_invite.is_table_qr,
                             'sensitive_consent', true));

  insert into notifications (user_id, kind, title, body, ref_id)
  values (v_invite.created_by, 'invitee_pending',
          p_display_name || ' entrou com seu convite',
          'Confirme ou recuse em Perfil → Convites aguardando você. Bairro: ' || p_neighborhood || '.',
          v_uid);

  return query select v_uid, 'pending'::membership_status;
end;
$$;

revoke execute on function public.redeem_invite(uuid, text, text, text, text, text, text, text, integer, boolean) from public, anon;
grant execute on function public.redeem_invite(uuid, text, text, text, text, text, text, text, integer, boolean) to authenticated;
