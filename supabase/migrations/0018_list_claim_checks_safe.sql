-- Yvy — lista pública de checagens por IA sem virar megafone de boato.
--
-- 0016 listava também as "não verificadas" e ordenava por requested_count.
-- Problemas: um boato colado era reescrito e exibido a todo visitante, e
-- qualquer um com a anon key podia pedir o mesmo texto em loop para pô-lo no
-- topo. Agora só entra checagem com veredito (com fonte, garantido pela
-- Edge Function) e a ordem é a data da checagem.

create or replace function public.list_claim_checks(p_limit int default 30)
returns setof jsonb
language sql stable security definer set search_path = public as $$
  select claim_check_view(c)
    from claim_checks c
   where c.status = 'done' and c.claim_text is not null
     and c.result <> 'unverified'
     and c.checked_at > now() - interval '7 days'
   order by c.checked_at desc
   limit least(p_limit, 50);
$$;

revoke execute on function public.list_claim_checks(int) from public;
grant  execute on function public.list_claim_checks(int) to anon, authenticated;
