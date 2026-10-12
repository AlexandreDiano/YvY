-- Yvy — lista de quem a pessoa convidou (todas as situações).
--
-- Só apelido, bairro e situação — o mesmo que o convidador já via na fila de
-- confirmação. Nada de nome completo, telefone ou e-mail.

create or replace function public.my_invitees()
returns table (id uuid, display_name text, neighborhood text, city text, state text,
               membership_status membership_status, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.neighborhood, p.city, p.state, p.membership_status, p.created_at
    from profiles p
   where p.invited_by = auth.uid()
   order by p.created_at desc;
$$;

revoke execute on function public.my_invitees() from public, anon;
grant execute on function public.my_invitees() to authenticated;
