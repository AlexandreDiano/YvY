-- Yvy — fonte achada pela busca e cancelar a própria checagem.
--
-- 1. `source_auto`: o link da fonte foi encontrado pela busca automática
--    (Tavily), não colado pela equipe. A tela mostra "confira se a fonte diz
--    isso"; a equipe só confere, não sai caçando link.
--
-- 2. cancel_claim_request: quem pediu uma checagem pode desistir enquanto ela
--    está na fila. O mesmo texto pode ter sido pedido por outras pessoas
--    (mesma linha, requested_count): o pedido só some quando ninguém mais
--    espera por ele. Só o aparelho que pediu conhece o id.

alter table fact_checks add column if not exists source_auto boolean not null default false;
alter table proposal_cards add column if not exists source_auto boolean not null default false;

create or replace function public.cancel_claim_request(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  update claim_checks
     set requested_count = requested_count - 1
   where id = p_id and status in ('queued', 'failed');
  delete from claim_checks
   where id = p_id and status in ('queued', 'failed') and requested_count <= 0;
end;
$$;
revoke execute on function public.cancel_claim_request(uuid) from public;
grant execute on function public.cancel_claim_request(uuid) to anon, authenticated;

/** Preenche o link de fonte de conteúdo editorial (service role, Edge Function). */
create or replace function public.set_auto_source(p_table text, p_id uuid, p_url text)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_table = 'fact_checks' then
    update fact_checks set source_url = p_url, source_auto = true where id = p_id and source_url is null;
  elsif p_table = 'proposal_cards' then
    update proposal_cards set source_url = p_url, source_auto = true where id = p_id and source_url is null;
  end if;
end;
$$;
revoke execute on function public.set_auto_source(text, uuid, text) from public, anon, authenticated;
grant execute on function public.set_auto_source(text, uuid, text) to service_role;
