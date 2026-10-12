-- Yvy — trocar papel pelo app (decisão de 11/10).
--
-- Admin promove membro a moderador e tira a qualquer momento. Admin também
-- pode dar a outra pessoa a permissão de fazer o mesmo ("gerente de papéis").
-- Só admin dá ou tira essa permissão. Ninguém mexe em admin nem em si mesmo
-- por aqui: admin continua só pelo SQL Editor.
--
-- Papel segue sem UPDATE para o cliente (0006): tudo passa por RPC DEFINER,
-- e a trigger audit_role_change grava quem fez.

create table if not exists role_managers (
  user_id     uuid primary key references profiles(id) on delete cascade,
  granted_by  uuid not null references profiles(id),
  granted_at  timestamptz not null default now()
);
alter table role_managers enable row level security;
revoke all on role_managers from public, anon, authenticated;
-- Sem policy nem grant: só as funções abaixo leem e escrevem.

create or replace function public.can_manage_roles() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from role_managers r join profiles p on p.id = r.user_id
     where r.user_id = auth.uid() and p.is_active and p.membership_status = 'active');
$$;
revoke execute on function public.can_manage_roles() from public, anon;
grant execute on function public.can_manage_roles() to authenticated;

/** Membros confirmados para escolher quem promover. Só apelido, bairro e papel. */
create or replace function public.list_members(p_query text default null)
returns table (id uuid, display_name text, neighborhood text, city text, state text,
               role user_role, is_role_manager boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_manage_roles() then
    raise exception 'Sem permissão para mudar papéis.' using errcode = '42501';
  end if;
  return query
  select p.id, p.display_name, p.neighborhood, p.city, p.state, p.role,
         exists (select 1 from role_managers r where r.user_id = p.id)
    from profiles p
   where p.membership_status = 'active' and p.is_active
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

/** Membro ↔ moderador. Moderador modera o bairro do próprio cadastro. */
create or replace function public.set_member_role(p_user uuid, p_role user_role)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v profiles;
begin
  if not public.can_manage_roles() then
    raise exception 'Sem permissão para mudar papéis.' using errcode = '42501';
  end if;
  if p_role not in ('militant', 'moderator') then
    raise exception 'Por aqui só dá para escolher membro ou moderador.' using errcode = '22023';
  end if;
  if p_user = auth.uid() then
    raise exception 'Ninguém muda o próprio papel.' using errcode = '42501';
  end if;

  select * into v from profiles where id = p_user for update;
  if v.id is null or v.membership_status <> 'active' or not v.is_active then
    raise exception 'Membro não encontrado ou não confirmado.' using errcode = 'P0002';
  end if;
  if v.role = 'admin' then
    raise exception 'Admin não muda por aqui.' using errcode = '42501';
  end if;
  if v.role = p_role then
    return;
  end if;

  if p_role = 'moderator' and (v.neighborhood is null or v.city is null) then
    raise exception 'Cadastro sem bairro/cidade: não dá para saber onde moderar.' using errcode = '22023';
  end if;

  update profiles set role = p_role where id = p_user;

  if p_role = 'moderator' then
    insert into moderators (user_id, neighborhood, city, state)
    values (p_user, v.neighborhood, v.city, coalesce(v.state, ''))
    on conflict (user_id, neighborhood, city) do update set is_active = true;
  else
    update moderators set is_active = false where user_id = p_user;
  end if;

  insert into notifications (user_id, kind, title, body)
  values (p_user, 'role_changed',
          case when p_role = 'moderator' then 'Você agora é moderador' else 'Você voltou a ser membro' end,
          case when p_role = 'moderator'
               then 'Você modera o bairro ' || v.neighborhood || ' e pode gerar convite à distância.'
               else 'A moderação do bairro saiu da sua conta.' end);
end;
$$;
revoke execute on function public.set_member_role(uuid, user_role) from public, anon;
grant execute on function public.set_member_role(uuid, user_role) to authenticated;

/** Dar ou tirar a permissão de mudar papéis. Só admin. */
create or replace function public.set_role_manager(p_user uuid, p_enabled boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Só admin dá essa permissão.' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'Admin já tem essa permissão.' using errcode = '22023';
  end if;
  if p_enabled then
    if not exists (select 1 from profiles where id = p_user and membership_status = 'active' and is_active) then
      raise exception 'Membro não encontrado ou não confirmado.' using errcode = 'P0002';
    end if;
    insert into role_managers (user_id, granted_by) values (p_user, auth.uid())
    on conflict (user_id) do nothing;
  else
    delete from role_managers where user_id = p_user;
  end if;
  insert into audit_log (user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when p_enabled then 'grant_role_manager' else 'revoke_role_manager' end,
          'profile', p_user, '{}'::jsonb);
end;
$$;
revoke execute on function public.set_role_manager(uuid, boolean) from public, anon;
grant execute on function public.set_role_manager(uuid, boolean) to authenticated;
