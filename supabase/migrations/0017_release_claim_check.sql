-- Yvy — falha que não é culpa do item (sem crédito na Anthropic, chave
-- inválida) devolve o item à fila sem gastar tentativa. Sem isso, três
-- rodadas do cron com a conta sem saldo marcariam todos os pedidos como
-- 'failed'.

create or replace function public.release_claim_check(p_id uuid, p_error text)
returns void
language sql volatile security definer set search_path = public as $$
  update claim_checks
     set status = 'queued', attempts = greatest(attempts - 1, 0), error = left(p_error, 500)
   where id = p_id;
$$;

revoke execute on function public.release_claim_check(uuid, text) from public, anon, authenticated;
grant  execute on function public.release_claim_check(uuid, text) to service_role;
