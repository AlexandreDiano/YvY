-- Yvy — monitor de promessas (YVY-130, decisão de 27/10).
--
-- Cada trecho conferido do plano de governo (government_plans.items, 0027) é
-- uma promessa. A equipe registra em que pé ela está, sempre com prova: link
-- oficial (lei, decreto, MP, PL, programa, orçamento), data e nota curta.
--
--   * plan_promise_updates: histórico, só cresce. Correção = nova linha.
--     Ninguém escreve direto: só a RPC set_plan_promise_status.
--   * plan_promises: um trecho por linha, com a chave e o status mais recente.
--   * plan_promise_history: o histórico sem quem registrou (o autor fica na
--     tabela e no audit_log, nunca vai a público).
--
-- As duas views são públicas (anon): "área pública, sem conta" é pedido do
-- YVY-130. O texto da promessa é o trecho literal do plano; nada aqui resume.
-- Quem não tem status ainda aparece como "sem avaliação" no app: não dizemos
-- "não iniciada" sem prova.

do $$ begin
  create type promise_status as enum ('not_started', 'in_progress', 'fulfilled', 'partial', 'broken');
exception when duplicate_object then null; end $$;

-- Chave do trecho: o array não tem id e o plan-import pode reordenar, então
-- a chave é md5(sq|tema|texto|pagina). A mesma conta aparece na view e na
-- RPC, escrita por extenso: função chamada de dentro da view é executada com o
-- privilégio de quem consulta (anon), não do dono da view.

create table if not exists plan_promise_updates (
  id            uuid primary key default gen_random_uuid(),
  sq_candidato  text not null references government_plans (sq_candidato) on delete cascade,
  promise_key   text not null,
  status        promise_status not null,
  source_url    text not null check (source_url ~* '^https?://[^ ]+\.[^ ]+'),
  evidence_date date not null,
  note          text not null check (char_length(note) between 1 and 280),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists plan_promise_updates_key on plan_promise_updates (promise_key, created_at desc);

alter table plan_promise_updates enable row level security;
-- Sem policy e sem grant: a tabela não vai à API. Leitura pelas views,
-- escrita pela RPC.
revoke all on plan_promise_updates from public, anon, authenticated;

-- A 0048 (que cria audit_attach) está em espera na produção; quando entrar,
-- o laço dela liga a auditoria nesta tabela também. Mesmo esquema da 0050.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'audit_attach') then
    perform public.audit_attach('plan_promise_updates');
  end if;
end $$;

-- Views donas (security_invoker = false): leem a tabela fechada. Só select.
create or replace view public.plan_promises
with (security_invoker = false) as
select gp.sq_candidato,
       md5(gp.sq_candidato || '|' || coalesce(e.item->>'tema', '') || '|' || coalesce(e.item->>'texto', '') || '|' || coalesce(e.item->>'pagina', '')) as promise_key,
       e.n::int                                       as position,
       coalesce(e.item->>'tema', '')                  as tema,
       e.item->>'texto'                               as texto,
       nullif(e.item->>'pagina', '')::int             as pagina,
       u.status,
       u.source_url,
       u.evidence_date,
       u.note,
       u.created_at                                   as updated_at
  from government_plans gp
 cross join lateral jsonb_array_elements(gp.items) with ordinality as e(item, n)
  left join lateral (
        select x.status, x.source_url, x.evidence_date, x.note, x.created_at
          from plan_promise_updates x
         where x.promise_key = md5(gp.sq_candidato || '|' || coalesce(e.item->>'tema', '') || '|' || coalesce(e.item->>'texto', '') || '|' || coalesce(e.item->>'pagina', ''))
         order by x.created_at desc
         limit 1) u on true
 where gp.verified;

create or replace view public.plan_promise_history
with (security_invoker = false) as
select x.id, x.sq_candidato, x.promise_key, x.status, x.source_url, x.evidence_date, x.note, x.created_at
  from plan_promise_updates x
  join government_plans gp on gp.sq_candidato = x.sq_candidato and gp.verified;

revoke all on public.plan_promises, public.plan_promise_history from public, anon, authenticated;
grant select on public.plan_promises, public.plan_promise_history to anon, authenticated;

-- Moderador/admin ativo registra o status, com prova. Mesmo portão de
-- promote_claim_check (is_staff), mais a conta não suspensa.
create or replace function public.set_plan_promise_status(
  p_sq            text,
  p_key           text,
  p_status        promise_status,
  p_source_url    text,
  p_evidence_date date,
  p_note          text
)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_id   uuid;
  v_url  text := nullif(btrim(p_source_url), '');
  v_note text := nullif(btrim(p_note), '');
begin
  if not public.is_staff()
     or not coalesce((select is_active from profiles where id = auth.uid()), false) then
    raise exception 'Só moderador ou admin muda o status de promessa.' using errcode = '42501';
  end if;
  if p_status is null then
    raise exception 'Falta o status.';
  end if;
  if v_url is null or v_url !~* '^https?://[^ ]+\.[^ ]+' then
    raise exception 'Sem fonte (link http) não dá para mudar o status.';
  end if;
  if p_evidence_date is null then
    raise exception 'Falta a data da prova.';
  end if;
  if p_evidence_date > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A data da prova não pode ser no futuro.';
  end if;
  if v_note is null then
    raise exception 'Falta a nota.';
  end if;
  if char_length(v_note) > 280 then
    raise exception 'Nota longa demais (até 280 letras).';
  end if;
  if not exists (
    select 1
      from government_plans gp, jsonb_array_elements(gp.items) e(item)
     where gp.sq_candidato = p_sq and gp.verified
       and md5(gp.sq_candidato || '|' || coalesce(e.item->>'tema', '') || '|' || coalesce(e.item->>'texto', '') || '|' || coalesce(e.item->>'pagina', '')) = p_key
  ) then
    raise exception 'Promessa não encontrada no plano conferido.';
  end if;

  insert into plan_promise_updates (sq_candidato, promise_key, status, source_url, evidence_date, note, created_by)
  values (p_sq, p_key, p_status, v_url, p_evidence_date, v_note, auth.uid())
  returning id into v_id;

  insert into audit_log (user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'plan_promise_status', 'plan_promise_updates', v_id,
          jsonb_build_object('sq_candidato', p_sq, 'promise_key', p_key, 'status', p_status,
                             'source_url', v_url, 'evidence_date', p_evidence_date));
  return v_id;
end;
$$;
revoke execute on function public.set_plan_promise_status(text, text, promise_status, text, date, text)
  from public, anon;
grant execute on function public.set_plan_promise_status(text, text, promise_status, text, date, text)
  to authenticated;
