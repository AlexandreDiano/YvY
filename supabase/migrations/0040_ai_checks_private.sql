-- Yvy — checagem por IA deixa de ser pública (decisão de 12/10, revisão
-- jurídica preliminar).
--
-- Resultado de IA sem revisão humana, exibido a todo visitante e com
-- veredito ("Mentira"), é o tipo de conteúdo que mais facilmente vira pedido
-- de remoção/direito de resposta em período eleitoral. A partir daqui:
--  - quem pediu a checagem continua vendo o resultado dela
--    (request_claim_check / get_claim_checks não mudam);
--  - a lista "checadas por IA nos últimos 7 dias" é só da equipe
--    (moderador/admin), para revisar e promover a fact_checks;
--  - público vê só o que a equipe aprovou (fact_checks).

create or replace function public.list_claim_checks(p_limit int default 30)
returns setof jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Só a equipe vê a lista de checagens por IA.' using errcode = '42501';
  end if;
  return query
    select claim_check_view(c)
      from claim_checks c
     where c.status = 'done' and c.claim_text is not null
       and c.result <> 'unverified'
       and c.checked_at > now() - interval '7 days'
     order by c.checked_at desc
     limit least(p_limit, 50);
end;
$$;

revoke execute on function public.list_claim_checks(int) from public, anon;
grant  execute on function public.list_claim_checks(int) to authenticated;
