-- Checagem por IA só fica pública depois que alguém da equipe valida
-- (decisão de 15/10, depois da conversa com o advogado).
--
-- Até aqui a promoção era só pelo SQL Editor, só admin, e nada impedia
-- promover a mesma checagem duas vezes. Agora:
--  - moderador ou admin valida pelo app, podendo corrigir o texto da IA antes;
--  - só publica com fonte e com resultado diferente de "não verificado";
--  - a checagem guarda qual fact_check virou, quem validou e quando;
--  - quem pediu passa a ver a versão validada (com selo, pode compartilhar).

alter table claim_checks
  add column fact_check_id uuid references fact_checks (id) on delete set null,
  add column reviewed_by   uuid references profiles (id) on delete set null,
  add column reviewed_at   timestamptz;

-- Depois de validada, quem pediu vê o que a equipe publicou, não o texto da
-- IA (que pode até ter sido rechecado depois e mudado).
create or replace function public.claim_check_view(c claim_checks)
returns jsonb language sql stable set search_path = public as $$
  select case
    when f.id is not null then jsonb_build_object(
      'id', c.id,
      'status', c.status,
      'claim_text', f.claim_text,
      'result', f.result,
      'explanation', f.explanation,
      'source_name', f.source_name,
      'source_url', f.source_url,
      'checked_at', c.reviewed_at,
      'reviewed', true)
    else jsonb_build_object(
      'id', c.id,
      'status', c.status,
      'claim_text', c.claim_text,
      'result', c.result,
      'explanation', c.explanation,
      'source_name', c.source_name,
      'source_url', c.source_url,
      'checked_at', c.checked_at,
      'reviewed', false)
  end
  from (select 1) _
  left join fact_checks f on f.id = c.fact_check_id and f.is_active;
$$;

-- Lista da equipe: só o que ainda falta revisar.
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
       and c.fact_check_id is null
       and c.checked_at > now() - interval '7 days'
     order by c.checked_at desc
     limit least(p_limit, 50);
end;
$$;

drop function if exists public.promote_claim_check(uuid);

create or replace function public.promote_claim_check(
  p_id          uuid,
  p_claim       text default null,
  p_result      check_result default null,
  p_explanation text default null
)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_row    claim_checks;
  v_id     uuid;
  v_claim  text;
  v_result check_result;
  v_expl   text;
begin
  if not public.is_staff() then
    raise exception 'Só moderador ou admin valida checagem.' using errcode = '42501';
  end if;

  select * into v_row from claim_checks where id = p_id and status = 'done' for update;
  if not found then
    raise exception 'Checagem não encontrada ou não concluída.';
  end if;
  if v_row.fact_check_id is not null then
    raise exception 'Essa checagem já foi validada.';
  end if;

  v_claim  := coalesce(nullif(trim(p_claim), ''), v_row.claim_text);
  v_result := coalesce(p_result, v_row.result);
  v_expl   := coalesce(nullif(trim(p_explanation), ''), v_row.explanation);

  if v_result = 'unverified' then
    raise exception 'Checagem sem conclusão não vai a público.';
  end if;
  if v_row.source_url is null then
    raise exception 'Sem fonte não dá para publicar.';
  end if;
  if v_claim is null or v_expl is null then
    raise exception 'Falta a afirmação ou a explicação.';
  end if;

  insert into fact_checks (claim_text, result, explanation, source_url, source_name)
  values (left(v_claim, 500), v_result, left(v_expl, 800), v_row.source_url, v_row.source_name)
  returning id into v_id;

  update claim_checks
     set fact_check_id = v_id, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;

  insert into audit_log (user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'claim_check_published', 'claim_checks', p_id,
          jsonb_build_object(
            'fact_check_id', v_id,
            'ai_result', v_row.result,
            'published_result', v_result,
            'edited', v_claim is distinct from v_row.claim_text
                      or v_result is distinct from v_row.result
                      or v_expl is distinct from v_row.explanation));
  return v_id;
end;
$$;

revoke execute on function public.promote_claim_check(uuid, text, check_result, text) from public, anon;
grant  execute on function public.promote_claim_check(uuid, text, check_result, text) to authenticated;
revoke execute on function public.claim_check_view(claim_checks) from public, anon, authenticated;
