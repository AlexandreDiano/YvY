-- Yvy — dois ajustes de 11/10.
--
-- 1. Mapa: membro comum vê só o próprio bairro (decisão do admin). Admin e
--    moderador continuam vendo todos os bairros com alguém.
-- 2. Feedback: "feito" e "descartado" são finais. Depois de marcado, não volta
--    para outra situação; e nada volta para "novo".

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
      or (a.neighborhood = me.neighborhood and a.city = me.city)
   order by a.n desc
   limit 500;
$$;
revoke execute on function public.members_by_area() from public, anon;
grant execute on function public.members_by_area() to authenticated;

create or replace function public.feedback_status_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if old.status in ('feito', 'descartado') then
      raise exception 'Já marcado como %: não muda mais.', old.status using errcode = '42501';
    end if;
    if new.status = 'novo' then
      raise exception 'Não dá para voltar para novo.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.feedback_status_guard() from public, anon, authenticated;

drop trigger if exists trg_feedback_status_guard on feedback;
create trigger trg_feedback_status_guard before update of status on feedback
  for each row execute function public.feedback_status_guard();
