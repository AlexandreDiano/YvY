-- Yvy — quem convidou quem (decisão de 18/10).
--
-- 1. Quem convidou também libera o convite do próprio convidado. Afrouxa a
--    0036 (12/10), em que só admin, quem muda papéis e o moderador do bairro
--    liberavam. Continua valendo: quem libera precisa poder convidar.
-- 2. my_invitees diz se cada convidado já pode convidar e quantos ele trouxe.
-- 3. invitees_of(p_user): admin, quem muda papéis e moderador (do bairro do
--    membro) veem quem aquele membro convidou. A lista de Membros mostra isso
--    num abre/fecha: um nível só, e o convidado que convidou alguém aparece de
--    novo na lista com os convidados dele.
-- Entre pessoas continua só apelido, bairro e situação.

/** Quem chama pode liberar/tirar convite desta pessoa? */
create or replace function public.can_grant_invites_for(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage_roles() or exists (
    select 1 from profiles p
     where p.id = p_user
       and (public.is_moderator_for(p.neighborhood, p.city)
            or (p.invited_by = auth.uid() and public.can_invite()))
  );
$$;
revoke execute on function public.can_grant_invites_for(uuid) from public, anon, authenticated;

/** Liberar ou tirar o convite de um membro comum (texto do aviso mudou). */
create or replace function public.set_invite_permission(p_user uuid, p_enabled boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v profiles;
begin
  if p_user = auth.uid() then
    raise exception 'Ninguém libera o próprio convite.' using errcode = '42501';
  end if;
  if not public.can_grant_invites_for(p_user) then
    raise exception 'Sem permissão para liberar convite desta pessoa.' using errcode = '42501';
  end if;

  select * into v from profiles where id = p_user;
  if v.id is null or v.membership_status <> 'active' or not v.is_active then
    raise exception 'Membro não encontrado ou não confirmado.' using errcode = 'P0002';
  end if;
  if v.role <> 'militant' then
    raise exception 'Moderador e admin já convidam.' using errcode = '22023';
  end if;

  if p_enabled then
    insert into invite_grants (user_id, granted_by) values (p_user, auth.uid())
    on conflict (user_id) do nothing;
  else
    delete from invite_grants where user_id = p_user;
  end if;

  insert into audit_log (user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when p_enabled then 'grant_invite' else 'revoke_invite' end,
          'profile', p_user, '{}'::jsonb);

  insert into notifications (user_id, kind, title, body)
  values (p_user, 'role_changed',
          case when p_enabled then 'Você pode convidar' else 'Convite desligado' end,
          case when p_enabled
               then 'Seu QRCode de convite fica em Perfil › Convidar. Use só com a pessoa na sua frente.'
               else 'Você não gera mais convites. Se acha que é engano, fale com quem te convidou ou com a moderação do bairro.' end);
end;
$$;
revoke execute on function public.set_invite_permission(uuid, boolean) from public, anon;
grant execute on function public.set_invite_permission(uuid, boolean) to authenticated;

-- my_invitees ganha colunas: drop + create.
drop function if exists public.my_invitees();
create function public.my_invitees()
returns table (id uuid, display_name text, neighborhood text, city text, state text,
               membership_status membership_status, created_at timestamptz,
               role user_role, can_invite boolean, invited_count int)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.neighborhood, p.city, p.state, p.membership_status, p.created_at,
         p.role,
         p.role in ('moderator', 'admin') or exists (select 1 from invite_grants g where g.user_id = p.id),
         (select count(*)::int from profiles c where c.invited_by = p.id)
    from profiles p
   where p.invited_by = auth.uid()
   order by p.created_at desc;
$$;
revoke execute on function public.my_invitees() from public, anon;
grant execute on function public.my_invitees() to authenticated;

/** Quem este membro convidou. Para admin, quem muda papéis e moderador do bairro dele. */
create or replace function public.invitees_of(p_user uuid)
returns table (id uuid, display_name text, neighborhood text, city text, state text,
               membership_status membership_status, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.can_manage_roles() or exists (
            select 1 from profiles m
             where m.id = p_user and public.is_moderator_for(m.neighborhood, m.city))) then
    raise exception 'Sem permissão para ver os convidados deste membro.' using errcode = '42501';
  end if;
  return query
  select p.id, p.display_name, p.neighborhood, p.city, p.state, p.membership_status, p.created_at
    from profiles p
   where p.invited_by = p_user
   order by p.created_at desc;
end;
$$;
revoke execute on function public.invitees_of(uuid) from public, anon;
grant execute on function public.invitees_of(uuid) to authenticated;

-- list_members (0036) com quantos cada um convidou e por quem entrou.
drop function if exists public.list_members(text);
create function public.list_members(p_query text default null)
returns table (id uuid, display_name text, neighborhood text, city text, state text,
               role user_role, is_role_manager boolean, can_invite boolean,
               invited_count int, invited_by_name text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_all boolean := public.can_manage_roles();
begin
  if not v_all and public.my_role() is distinct from 'moderator' then
    raise exception 'Sem permissão para ver a lista de membros.' using errcode = '42501';
  end if;
  return query
  select p.id, p.display_name, p.neighborhood, p.city, p.state, p.role,
         exists (select 1 from role_managers r where r.user_id = p.id),
         p.role in ('moderator', 'admin') or exists (select 1 from invite_grants g where g.user_id = p.id),
         (select count(*)::int from profiles c where c.invited_by = p.id),
         (select i.display_name from profiles i where i.id = p.invited_by)
    from profiles p
   where p.membership_status = 'active' and p.is_active
     and (v_all or public.is_moderator_for(p.neighborhood, p.city))
     and (coalesce(btrim(p_query), '') = ''
          or p.display_name ilike '%' || btrim(p_query) || '%'
          or p.neighborhood ilike '%' || btrim(p_query) || '%'
          or p.city ilike '%' || btrim(p_query) || '%')
   order by (p.role = 'admin') desc, (p.role = 'moderator') desc, p.display_name
   limit 300;
end;
$$;
revoke execute on function public.list_members(text) from public, anon;
grant execute on function public.list_members(text) to authenticated;
