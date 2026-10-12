-- Yvy — convidar vira permissão (decisão de 12/10).
--
-- Antes todo membro confirmado gerava convite. Agora, por padrão, só
-- moderador e admin. Membro comum convida se alguém liberar:
--   - admin e quem pode mudar papéis (0032): qualquer membro;
--   - moderador: membros do bairro que ele modera.
-- Quem já tinha convidado antes NÃO ganha a permissão automaticamente.
--
-- A trava é a policy de INSERT em invites: esconder o botão no app é só
-- conforto.

create table if not exists invite_grants (
  user_id     uuid primary key references profiles(id) on delete cascade,
  granted_by  uuid not null references profiles(id),
  granted_at  timestamptz not null default now()
);
alter table invite_grants enable row level security;
revoke all on invite_grants from public, anon, authenticated;
-- Sem policy nem grant: só as funções abaixo leem e escrevem.

/** Quem está chamando pode gerar convite agora? */
create or replace function public.can_invite() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
     where p.id = auth.uid() and p.is_active and p.membership_status = 'active'
       and (p.role in ('moderator', 'admin')
            or exists (select 1 from invite_grants g where g.user_id = p.id))
  );
$$;
revoke execute on function public.can_invite() from public, anon;
grant execute on function public.can_invite() to authenticated;

/** Quem chama pode liberar/tirar convite desta pessoa? */
create or replace function public.can_grant_invites_for(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage_roles() or exists (
    select 1 from profiles p
     where p.id = p_user and public.is_moderator_for(p.neighborhood, p.city)
  );
$$;
revoke execute on function public.can_grant_invites_for(uuid) from public, anon, authenticated;

-- Policy de 0035 com can_invite() no lugar de is_militant_or_above().
drop policy if exists invites_insert_militant on invites;
create policy invites_insert_militant on invites
  for insert with check (
    public.can_invite()
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

/** Liberar ou tirar o convite de um membro comum. */
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
               then 'Agora você gera QRCode de convite em Perfil › Convidar. Só para quem está na sua frente.'
               else 'Sua conta deixou de gerar convites. Fale com a moderação do seu bairro.' end);
end;
$$;
revoke execute on function public.set_invite_permission(uuid, boolean) from public, anon;
grant execute on function public.set_invite_permission(uuid, boolean) to authenticated;

-- list_members (0032) passa a abrir também para moderador, que vê só os
-- bairros que modera, e diz quem pode convidar. Mudou o retorno: drop + create.
drop function if exists public.list_members(text);
create function public.list_members(p_query text default null)
returns table (id uuid, display_name text, neighborhood text, city text, state text,
               role user_role, is_role_manager boolean, can_invite boolean)
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
         p.role in ('moderator', 'admin') or exists (select 1 from invite_grants g where g.user_id = p.id)
    from profiles p
   where p.membership_status = 'active' and p.is_active
     and (v_all or public.is_moderator_for(p.neighborhood, p.city))
     and (coalesce(btrim(p_query), '') = ''
          or p.display_name ilike '%' || btrim(p_query) || '%'
          or p.neighborhood ilike '%' || btrim(p_query) || '%'
          or p.city ilike '%' || btrim(p_query) || '%')
   order by (p.role = 'admin') desc, (p.role = 'moderator') desc, p.display_name
   limit 100;
end;
$$;
revoke execute on function public.list_members(text) from public, anon;
grant execute on function public.list_members(text) to authenticated;
