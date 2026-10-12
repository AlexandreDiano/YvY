-- Yvy — funções auxiliares e RPCs.
--
-- Toda função SECURITY DEFINER fixa search_path: sem isso, um schema plantado
-- pelo chamador pode sequestrar a resolução de nomes.

-- ============================================================
-- Papel do usuário atual
-- ============================================================

create or replace function public.my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()), 'visitor'::user_role);
$$;

/**
 * Militante "de verdade": papel de base E confirmado pelo convidador.
 * O contexto trata pending como quem só vê conteúdo público (4.2, passo 10),
 * então a confirmação entra aqui e não em cada policy.
 */
create or replace function public.is_militant_or_above() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and is_active
      and role in ('militant', 'moderator', 'admin')
      and membership_status = 'active'
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and is_active);
$$;

-- O contexto tinha `and city = city` (parâmetro sombreando a coluna: sempre
-- verdadeiro, o que fazia qualquer moderador moderar qualquer cidade).
-- Parâmetros com prefixo p_ eliminam a ambiguidade.
create or replace function public.is_moderator_for(p_neighborhood text, p_city text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from moderators m
    where m.user_id = auth.uid()
      and m.neighborhood = p_neighborhood
      and m.city = p_city
      and m.is_active
  ) or public.is_admin();
$$;

create or replace function public.my_area() returns table (neighborhood text, city text)
language sql stable security definer set search_path = public as $$
  select neighborhood, city from profiles where id = auth.uid();
$$;

-- ============================================================
-- Exposição mínima de identidade
-- ============================================================

/**
 * Apelido de qualquer perfil. É o único dado de outra pessoa que o app mostra.
 * Existe como função DEFINER para que as views de feed e de ações possam
 * resolver "Camarada J.S." sem precisar de permissão de leitura em profiles.
 */
create or replace function public.display_name_of(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select display_name from profiles where id = p_id;
$$;

create or replace function public.participant_count(p_action uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from action_participants
  where action_id = p_action and status = 'confirmed';
$$;

-- ============================================================
-- Convites (fluxo 4.2)
-- ============================================================

/**
 * Resgate de convite — é por aqui que uma conta vira perfil no Yvy.
 *
 * O QRCode vem ANTES da conta: sem convite válido ninguém se cadastra, só
 * navega o conteúdo público (que nem precisa de sessão). Então esta função é o
 * único caminho de criação de perfil no sistema — não existe policy de insert
 * em `profiles` para cliente nenhum.
 *
 * Sequência no app: ler QRCode -> criar usuário (e-mail + senha) -> chamar
 * esta função com o token guardado da leitura.
 *
 * Nunca autoconfirma: entra 'pending' e quem libera é o convidador
 * (regra de ouro 5 do fluxo 4.2).
 */
create or replace function public.redeem_invite(
  p_token uuid,
  p_full_name text,
  p_display_name text,
  p_phone text default null,
  p_cep text default null,
  p_neighborhood text default null,
  p_city text default null,
  p_state text default null,
  p_location_precision int default 3
) returns table (profile_id uuid, membership_status membership_status)
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

  return query select v_uid, 'pending'::membership_status;
end;
$$;

/** Se o convidador é desativado, os pendentes dele são rejeitados (regra 6). */
create or replace function public.cascade_inviter_deactivation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_active and not new.is_active then
    update profiles
       set membership_status = 'rejected'
     where invited_by = new.id and membership_status = 'pending';
  end if;
  return new;
end;
$$;

create trigger trg_cascade_inviter
  after update of is_active on profiles
  for each row execute function public.cascade_inviter_deactivation();

-- ============================================================
-- Checagem de fatos (fluxo 4.6)
-- ============================================================

create or replace function public.search_fact_checks(q text, min_score real default 0.7)
returns setof fact_checks
language sql stable security definer set search_path = public, extensions as $$
  select *
    from fact_checks
   where is_active
     and similarity(lower(claim_text), lower(q)) >= min_score
   order by similarity(lower(claim_text), lower(q)) desc
   limit 3;
$$;

-- ============================================================
-- Puxada de voto (fluxo 4.5, fase 2)
-- ============================================================

/**
 * Forma rotas de até p_max eleitores, agrupando por bairro + local de votação.
 * Só moderador do bairro ou admin executa. Idempotente no sentido útil: só
 * pega eleitor que ainda não tem rota.
 */
create or replace function public.build_pull_routes(
  p_neighborhood text,
  p_city text,
  p_state text,
  p_max int default 5
) returns table (route_id uuid, voter_count int)
language plpgsql security definer set search_path = public as $$
declare
  v_place text;
  v_route uuid;
  v_ids uuid[];
  v_chunk uuid[];
  i int;
begin
  if not public.is_moderator_for(p_neighborhood, p_city) then
    raise exception 'Só a coordenação do bairro forma rotas.' using errcode = '42501';
  end if;
  if p_max is null or p_max < 1 or p_max > 10 then
    raise exception 'Máximo por rota deve estar entre 1 e 10.' using errcode = '22023';
  end if;

  for v_place in
    select distinct polling_place from voters
     where pull_route_id is null
       and neighborhood = p_neighborhood
       and city = p_city
  loop
    select array_agg(id order by created_at) into v_ids
      from voters
     where pull_route_id is null
       and neighborhood = p_neighborhood
       and city = p_city
       and polling_place = v_place;

    i := 1;
    while i <= array_length(v_ids, 1) loop
      v_chunk := v_ids[i : least(i + p_max - 1, array_length(v_ids, 1))];

      insert into pull_routes (neighborhood, city, state, max_voters)
      values (p_neighborhood, p_city, p_state, p_max)
      returning id into v_route;

      update voters set pull_route_id = v_route where id = any(v_chunk);

      return query select v_route, array_length(v_chunk, 1);
      i := i + p_max;
    end loop;
  end loop;

  insert into audit_log (user_id, action, entity_type, metadata)
  values (auth.uid(), 'build_pull_routes', 'pull_route',
          jsonb_build_object('neighborhood', p_neighborhood, 'city', p_city));
end;
$$;

-- ============================================================
-- Rotinas de tempo (agendadas em 0010_cron.sql)
-- ============================================================

/** Post sem resposta da moderação em 2h publica sozinho (fluxo 4.4, passo 6). */
create or replace function public.auto_approve_posts() returns int
language sql security definer set search_path = public as $$
  with done as (
    update posts set status = 'published'
     where status = 'pending' and created_at < now() - interval '2 hours'
    returning 1
  )
  select count(*)::int from done;
$$;

/** Ação vira 'completed' 2h depois do horário (fluxo 4.3, passo 9). */
create or replace function public.auto_complete_actions() returns int
language sql security definer set search_path = public as $$
  with done as (
    update actions set status = 'completed'
     where status in ('open', 'confirmed') and scheduled_at < now() - interval '2 hours'
    returning 1
  )
  select count(*)::int from done;
$$;

-- ============================================================
-- Auditoria
-- ============================================================

create or replace function public.audit_post_moderation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into audit_log (user_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'moderate_post', 'post', new.id,
            jsonb_build_object('from', old.status, 'to', new.status, 'note', new.moderator_note));
  end if;
  return new;
end;
$$;

create trigger trg_audit_post_moderation
  after update of status on posts
  for each row execute function public.audit_post_moderation();

create or replace function public.audit_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role or new.membership_status is distinct from old.membership_status then
    insert into audit_log (user_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'change_membership', 'profile', new.id,
            jsonb_build_object(
              'role_from', old.role, 'role_to', new.role,
              'status_from', old.membership_status, 'status_to', new.membership_status));
  end if;
  return new;
end;
$$;

create trigger trg_audit_role_change
  after update on profiles
  for each row execute function public.audit_role_change();

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_touch_profiles before update on profiles
  for each row execute function public.touch_updated_at();
create trigger trg_touch_actions before update on actions
  for each row execute function public.touch_updated_at();
create trigger trg_touch_cards before update on proposal_cards
  for each row execute function public.touch_updated_at();

/** flagged_count e troca para 'flagged' a partir de 3 denúncias (fluxo 4.4). */
create or replace function public.bump_flag_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  select count(*) into v_count from post_flags where post_id = new.post_id;
  update posts
     set flagged_count = v_count,
         status = case when v_count >= 3 and status = 'published' then 'flagged' else status end
   where id = new.post_id;
  return new;
end;
$$;

create trigger trg_bump_flag_count
  after insert on post_flags
  for each row execute function public.bump_flag_count();

-- ============================================================
-- Confirmação do convidado pelo convidador (fluxo 4.2, passo 10)
-- ============================================================

/**
 * O convidador precisa ver quem entrou com o convite dele e decidir. Em vez de
 * abrir `profiles` para leitura cruzada, estas duas funções expõem o mínimo:
 * apelido e área, nunca nome completo ou telefone.
 */
create or replace function public.my_pending_invitees()
returns table (id uuid, display_name text, neighborhood text, city text, state text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.neighborhood, p.city, p.state, p.created_at
    from profiles p
   where p.invited_by = auth.uid()
     and p.membership_status = 'pending'
   order by p.created_at;
$$;

create or replace function public.decide_invitee(p_invitee uuid, p_decision membership_status)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_decision not in ('active', 'rejected') then
    raise exception 'Decisão inválida.' using errcode = '22023';
  end if;

  update profiles
     set membership_status = p_decision
   where id = p_invitee
     and membership_status = 'pending'
     and (invited_by = auth.uid() or public.is_admin());

  if not found then
    raise exception 'Convite não encontrado ou já decidido.' using errcode = 'P0002';
  end if;
end;
$$;
