-- Yvy — avisa o convidador quando alguém entra pelo convite dele.
--
-- Antes o pedido de confirmação só aparecia em Perfil, e só se a tela fosse
-- aberta depois do cadastro. Agora redeem_invite também grava um aviso
-- (Avisos + contador da Base). Corpo da função igual ao anterior, mais o insert.

create or replace function public.redeem_invite(
  p_token uuid, p_full_name text, p_display_name text, p_phone text default null,
  p_cep text default null, p_neighborhood text default null, p_city text default null,
  p_state text default null, p_location_precision integer default 3)
returns table(profile_id uuid, membership_status membership_status)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
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

  select * into v_invite from invites where token = p_token for update;

  if v_invite.id is null then
    raise exception 'Convite não encontrado.' using errcode = 'P0002';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'Este convite expirou. Peça outro.' using errcode = 'P0003';
  end if;
  if v_invite.use_count >= v_invite.max_uses then
    raise exception 'Este convite já foi utilizado.' using errcode = 'P0004';
  end if;
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
