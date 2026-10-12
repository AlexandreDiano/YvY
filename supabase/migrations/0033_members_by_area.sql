-- Yvy — quantos membros há em cada bairro, para o mapa da aba Ações.
--
-- Só contagem: nada de apelido nem de quem é. Mesmo assim é informação nova
-- (profiles_public só mostra o próprio bairro), então:
--   - admin e moderador veem todos os bairros com alguém;
--   - membro vê o próprio bairro e os bairros com pelo menos 3 pessoas —
--     não aponta no mapa onde há 1 ou 2 pessoas sozinhas.
-- Pendente/recusado não vê nada e não é contado.

create or replace function public.members_by_area()
returns table (neighborhood text, city text, state text, members int, mine boolean)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.neighborhood, p.city, p.role
      from profiles p
     where p.id = auth.uid() and p.is_active and p.membership_status = 'active'
       and p.role in ('militant', 'moderator', 'admin')
  ),
  a as (
    select p.neighborhood, p.city, max(p.state) as state, count(*)::int as n
      from profiles p
     where p.membership_status = 'active' and p.is_active
       and p.neighborhood is not null and p.city is not null
     group by p.neighborhood, p.city
  )
  select a.neighborhood, a.city, a.state, a.n,
         coalesce(a.neighborhood = me.neighborhood and a.city = me.city, false)
    from a cross join me
   where me.role in ('moderator', 'admin')
      or a.n >= 3
      or (a.neighborhood = me.neighborhood and a.city = me.city)
   order by a.n desc
   limit 500;
$$;
revoke execute on function public.members_by_area() from public, anon;
grant execute on function public.members_by_area() to authenticated;
