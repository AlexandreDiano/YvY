-- Yvy — limites na reserva de convite (YVY-53, decisão de 12/10).
--
-- claim_invite (0035) é aberta a anon. Token é UUID — adivinhar é inviável —,
-- mas quem tiver uma foto do QRCode de mesa (5 min) pode reservar as 20 vagas
-- por script e travar o evento. Aqui:
--
-- 1. Por rede: no máximo 5 reservas pendentes do mesmo IP no mesmo convite
--    (IP do cabeçalho cf-connecting-ip; ver request_ip).
--    5, não 1: num evento com Wi-Fi do local, várias pessoas saem pelo mesmo
--    IP. Reserva que vira cadastro deixa de contar.
--    O IP NÃO é guardado: só md5(convite + IP), que serve para comparar
--    dentro daquele convite e não identifica ninguém fora dele. Sem IP no
--    pedido (chamada interna), o limite por rede não se aplica.
-- 2. Rajada: 8+ reservas no mesmo convite em 1 minuto vira linha no
--    audit_log e aviso para quem convidou (no máximo 1 aviso a cada 10 min).
-- 3. Quem convidou vê reservas pendentes x cadastros (invite_claim_stats) e
--    pode liberar as pendentes (release_invite_claims) — quem estava no meio
--    do cadastro escaneia de novo.
-- 4. Mensagem única ("inválido, vencido ou já usado") para convite que não
--    existe e para qualquer falha do código à distância: não diz se o código
--    digitado existe.

alter table invite_claims add column if not exists net_bucket text;
create index if not exists idx_invite_claims_bucket on invite_claims (invite_id, net_bucket);

/**
 * IP de quem chamou a API, ou null. Só `cf-connecting-ip`: a Cloudflare
 * preenche e o cliente não forja. `x-forwarded-for` NÃO serve — o primeiro
 * item vem de quem chama, e um script mandaria um IP falso por pedido e
 * nunca bateria no limite. Sem o cabeçalho, o limite por rede fica desligado
 * (melhor que enganado); a rajada e "Liberar vagas presas" continuam valendo.
 * Conferir em produção quais cabeçalhos chegam (ver YVY-53).
 */
create or replace function public.request_ip() returns text
language sql stable set search_path = public as $$
  select nullif(btrim(
    nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip'
  ), '');
$$;
revoke execute on function public.request_ip() from public, anon, authenticated;

create or replace function public.claim_invite(p_token uuid)
returns table(claim uuid, claim_expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_invite invites;
  v_held int;
  v_secret uuid;
  v_until timestamptz := now() + interval '24 hours';
  v_ip text := public.request_ip();
  v_bucket text;
  v_recent int;
  v_generic constant text := 'Convite inválido, vencido ou já usado. Peça outro a quem te convidou.';
begin
  select * into v_invite from invites where token = p_token for update;

  if v_invite.id is null then
    raise exception '%', v_generic using errcode = 'P0002';
  end if;
  if v_invite.scan_expires_at < now() or v_invite.expires_at < now() then
    if v_invite.is_remote then
      raise exception '%', v_generic using errcode = 'P0003';
    end if;
    raise exception 'Este QRCode expirou. Peça para gerar outro.' using errcode = 'P0003';
  end if;
  if auth.uid() is not null and v_invite.created_by = auth.uid() then
    raise exception 'Ninguém entra na base com o próprio convite.' using errcode = '42501';
  end if;

  select count(*) into v_held
    from invite_claims
   where invite_id = v_invite.id and redeemed_at is null and expires_at > now();
  if v_invite.use_count + v_held >= v_invite.max_uses then
    if v_invite.is_remote then
      raise exception '%', v_generic using errcode = 'P0004';
    end if;
    raise exception 'Este convite já foi utilizado.' using errcode = 'P0004';
  end if;

  if v_ip is not null then
    v_bucket := md5(v_invite.id::text || '|' || v_ip);
    if (select count(*) from invite_claims
         where invite_id = v_invite.id and net_bucket = v_bucket
           and redeemed_at is null and expires_at > now()) >= 5 then
      raise exception 'Muitas reservas seguidas desta rede. Termine os cadastros abertos ou peça ajuda a quem convidou.'
        using errcode = '53400';
    end if;
  end if;

  insert into invite_claims (invite_id, expires_at, net_bucket)
  values (v_invite.id, v_until, v_bucket)
  returning secret into v_secret;

  -- Rajada: registra e avisa quem convidou, no máximo a cada 10 min.
  select count(*) into v_recent
    from invite_claims
   where invite_id = v_invite.id and created_at > now() - interval '1 minute';
  if v_recent >= 8 and not exists (
       select 1 from audit_log
        where action = 'invite_claim_burst' and entity_id = v_invite.id
          and created_at > now() - interval '10 minutes') then
    insert into audit_log (user_id, action, entity_type, entity_id, metadata)
    values (null, 'invite_claim_burst', 'invite', v_invite.id,
            jsonb_build_object('claims_last_minute', v_recent, 'table_qr', v_invite.is_table_qr));
    insert into notifications (user_id, kind, title, body, ref_id)
    values (v_invite.created_by, 'invite_burst',
            'Muitas reservas seguidas no seu convite',
            v_recent || ' reservas no último minuto. Se não for a fila do evento, abra Convidar e toque em "Liberar vagas presas".',
            v_invite.id);
  end if;

  return query select v_secret, v_until;
end;
$$;

revoke execute on function public.claim_invite(uuid) from public;
grant execute on function public.claim_invite(uuid) to anon, authenticated;

/** Reservas pendentes x cadastros de um convite. Só quem criou. */
create or replace function public.invite_claim_stats(p_invite uuid)
returns table(redeemed int, pending int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from invites where id = p_invite and created_by = auth.uid()) then
    raise exception 'Convite não encontrado.' using errcode = 'P0002';
  end if;
  return query
    select (select use_count from invites where id = p_invite),
           (select count(*)::int from invite_claims
             where invite_id = p_invite and redeemed_at is null and expires_at > now());
end;
$$;
revoke execute on function public.invite_claim_stats(uuid) from public, anon;
grant execute on function public.invite_claim_stats(uuid) to authenticated;

/**
 * Libera as vagas presas: apaga reservas pendentes do convite. Só quem criou.
 * Quem estava no meio do cadastro precisa escanear de novo.
 */
create or replace function public.release_invite_claims(p_invite uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if not exists (select 1 from invites where id = p_invite and created_by = auth.uid()) then
    raise exception 'Convite não encontrado.' using errcode = 'P0002';
  end if;
  delete from invite_claims where invite_id = p_invite and redeemed_at is null;
  get diagnostics v_n = row_count;
  insert into audit_log (user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'release_invite_claims', 'invite', p_invite, jsonb_build_object('released', v_n));
  return v_n;
end;
$$;
revoke execute on function public.release_invite_claims(uuid) from public, anon;
grant execute on function public.release_invite_claims(uuid) to authenticated;
