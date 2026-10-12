-- Yvy — lista pública das checagens automáticas já feitas (válidas, 7 dias),
-- para compartilhar sem precisar checar de novo. Só a forma pública
-- (claim_check_view): nunca o texto colado. Mais pedidas primeiro.

create or replace function public.list_claim_checks(p_limit int default 30)
returns setof jsonb
language sql stable security definer set search_path = public as $$
  select claim_check_view(c)
    from claim_checks c
   where c.status = 'done' and c.claim_text is not null
     and c.checked_at > now() - interval '7 days'
   order by c.requested_count desc, c.checked_at desc
   limit least(p_limit, 50);
$$;

revoke execute on function public.list_claim_checks(int) from public;
grant  execute on function public.list_claim_checks(int) to anon, authenticated;
