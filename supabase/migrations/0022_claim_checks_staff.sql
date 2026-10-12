-- Yvy — ferramentas da equipe na fila de checagem.
--
--   * list_claim_queue: moderador/admin vê a fila (com o texto pedido, já
--     sem telefone/e-mail/CPF) para decidir o que checar agora;
--   * claim_check_by_id: a Edge Function pega UM item escolhido pela equipe
--     ("checar agora"), sem esperar o cron;
--   * delete_claim_check: moderador/admin apaga item que deu problema
--     (texto sem sentido, teste, abuso). Não é para censurar veredito: a
--     equipe pode promover ou apagar, nunca editar o resultado.

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('moderator', 'admin') from profiles where id = auth.uid()), false);
$$;
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

create or replace function public.list_claim_queue()
returns table (id uuid, status claim_status, input_text text, claim_text text, result check_result,
               error text, attempts int, requested_count int, queued_at timestamptz, checked_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Só moderador ou admin.';
  end if;
  return query
    select c.id, c.status, c.input_text, c.claim_text, c.result, c.error, c.attempts,
           c.requested_count, c.queued_at, c.checked_at
      from claim_checks c
     order by (c.status = 'done'), c.queued_at desc
     limit 100;
end;
$$;
revoke execute on function public.list_claim_queue() from public, anon;
grant execute on function public.list_claim_queue() to authenticated;

create or replace function public.delete_claim_check(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Só moderador ou admin.';
  end if;
  delete from claim_checks where id = p_id;
end;
$$;
revoke execute on function public.delete_claim_check(uuid) from public, anon;
grant execute on function public.delete_claim_check(uuid) to authenticated;

/** Um item específico para processar já (chamado pela Edge Function com service role). */
create or replace function public.claim_check_by_id(p_id uuid)
returns setof claim_checks
language sql volatile security definer set search_path = public as $$
  update claim_checks
     set status = 'processing', attempts = least(attempts, 2) + 1, queued_at = now(),
         input_text = coalesce(input_text, claim_text)
   where id = p_id
  returning *;
$$;
revoke execute on function public.claim_check_by_id(uuid) from public, anon, authenticated;
grant execute on function public.claim_check_by_id(uuid) to service_role;

/** Papel de um usuário (a Edge Function confere quem pediu "checar agora"). */
create or replace function public.role_of(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select role::text from profiles where id = p_user;
$$;
revoke execute on function public.role_of(uuid) from public, anon, authenticated;
grant execute on function public.role_of(uuid) to service_role;
