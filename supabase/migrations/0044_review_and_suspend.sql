-- Revisão de post já publicado, suspensão de conta e tirar checagem do ar
-- (pedidos de 15/10).
--
-- 1. Moderador ou admin manda um post publicado de volta para a fila
--    (status 'flagged'). Ele some do feed na hora. Na fila, quem modera
--    aquele nível decide: publica de novo, recusa com motivo (o autor é
--    avisado pelo trigger da 0021) ou recusa e suspende o autor.
-- 2. Suspender conta = is_active false. Com isso is_militant_or_above() e
--    is_admin() já cortam todo acesso da base. Admin suspende qualquer um
--    que não seja admin; moderador suspende membro comum do bairro que ele
--    modera. Reativar é só com admin. A pessoa recebe um aviso com o motivo.
-- 3. A equipe tira do ar uma checagem que já tinha sido aprovada.
-- 4. Publicar checagem da IA aceita fonte digitada pela equipe, para os casos
--    em que a IA não achou fonte mas a equipe achou.
--
-- E um furo: is_staff() não olhava is_active, então moderador suspenso
-- continuaria vendo a fila de checagem e publicando.

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('moderator', 'admin') and is_active from profiles where id = auth.uid()),
    false);
$$;

-- ------------------------------------------------------ 1. post para revisão

create or replace function public.send_post_to_review(p_post uuid, p_reason text)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_post posts;
begin
  if not public.is_staff() then
    raise exception 'Só moderador ou admin manda post para revisão.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Escreva o motivo da revisão.';
  end if;
  select * into v_post from posts where id = p_post for update;
  if not found or v_post.status <> 'published' then
    raise exception 'Post não encontrado ou não está publicado.';
  end if;

  update posts
     set status = 'flagged', moderator_id = auth.uid(), moderator_note = left(btrim(p_reason), 200)
   where id = p_post;

  insert into audit_log (user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'post_sent_to_review', 'posts', p_post,
          jsonb_build_object('reason', left(btrim(p_reason), 200), 'scope', v_post.scope));
end;
$$;

-- ------------------------------------------------------------ 2. suspensão

create or replace function public.set_member_active(p_user uuid, p_active boolean, p_reason text default null)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_target profiles;
begin
  select * into v_target from profiles where id = p_user for update;
  if not found then
    raise exception 'Membro não encontrado.';
  end if;
  if p_user = auth.uid() then
    raise exception 'Ninguém suspende a própria conta por aqui.';
  end if;
  if v_target.role = 'admin' then
    raise exception 'Admin não é suspenso pelo app.' using errcode = '42501';
  end if;

  if p_active then
    if not public.is_admin() then
      raise exception 'Só admin reativa conta.' using errcode = '42501';
    end if;
  else
    if coalesce(btrim(p_reason), '') = '' then
      raise exception 'Escreva o motivo da suspensão.';
    end if;
    if not (public.is_admin()
            or (v_target.role = 'militant'
                and public.is_staff()
                and public.is_moderator_for(v_target.neighborhood, v_target.city))) then
      raise exception 'Sem permissão para suspender esta conta.' using errcode = '42501';
    end if;
  end if;

  if v_target.is_active = p_active then
    return;
  end if;

  update profiles set is_active = p_active where id = p_user;
  if not p_active then
    -- tira também da moderação, se for moderador
    update moderators set is_active = false where user_id = p_user;
  end if;

  insert into notifications (user_id, kind, title, body)
  values (p_user,
          case when p_active then 'account_reactivated' else 'account_suspended' end,
          case when p_active then 'Sua conta foi reativada' else 'Sua conta foi suspensa' end,
          case when p_active then null else left(btrim(p_reason), 300) end);

  insert into audit_log (user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when p_active then 'member_reactivated' else 'member_suspended' end,
          'profiles', p_user, jsonb_build_object('reason', left(btrim(coalesce(p_reason, '')), 300)));
end;
$$;

-- ----------------------------------------------- 3. tirar checagem do ar

create or replace function public.unpublish_fact_check(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Só moderador ou admin tira checagem do ar.' using errcode = '42501';
  end if;
  update fact_checks set is_active = false where id = p_id and is_active;
  if not found then
    raise exception 'Checagem não encontrada ou já fora do ar.';
  end if;
  -- quem pediu a checagem volta a ver só o resultado da IA, sem selo
  update claim_checks set fact_check_id = null where fact_check_id = p_id;
  insert into audit_log (user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'fact_check_unpublished', 'fact_checks', p_id, '{}'::jsonb);
end;
$$;

-- ---------------------------------- 4. publicar com fonte achada pela equipe

-- A lista da equipe passa a mostrar também o que a IA não conseguiu concluir:
-- a equipe pode achar a fonte e publicar.
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
       and c.fact_check_id is null
       and c.checked_at > now() - interval '7 days'
     order by c.checked_at desc
     limit least(p_limit, 50);
end;
$$;

drop function if exists public.promote_claim_check(uuid, text, check_result, text);

create or replace function public.promote_claim_check(
  p_id          uuid,
  p_claim       text default null,
  p_result      check_result default null,
  p_explanation text default null,
  p_source_url  text default null,
  p_source_name text default null
)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_row    claim_checks;
  v_id     uuid;
  v_claim  text;
  v_result check_result;
  v_expl   text;
  v_url    text;
  v_name   text;
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

  v_claim  := coalesce(nullif(btrim(p_claim), ''), v_row.claim_text);
  v_result := coalesce(p_result, v_row.result);
  v_expl   := coalesce(nullif(btrim(p_explanation), ''), v_row.explanation);
  v_url    := coalesce(nullif(btrim(p_source_url), ''), v_row.source_url);
  v_name   := coalesce(nullif(btrim(p_source_name), ''), v_row.source_name);

  if v_result is null or v_result = 'unverified' then
    raise exception 'Checagem sem conclusão não vai a público.';
  end if;
  if v_url is null or v_url !~* '^https?://[^ ]+\.[^ ]+' then
    raise exception 'Sem fonte (link http) não dá para publicar.';
  end if;
  if v_claim is null or v_expl is null then
    raise exception 'Falta a afirmação ou a explicação.';
  end if;

  insert into fact_checks (claim_text, result, explanation, source_url, source_name)
  values (left(v_claim, 500), v_result, left(v_expl, 800), v_url, left(v_name, 120))
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
            'source_from_team', v_url is distinct from v_row.source_url,
            'edited', v_claim is distinct from v_row.claim_text
                      or v_result is distinct from v_row.result
                      or v_expl is distinct from v_row.explanation));
  return v_id;
end;
$$;

-- O aviso de post recusado passa a trazer um trecho do post, para a pessoa
-- saber de qual post se trata (pode ter vários).
create or replace function public.notify_post_decision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('published', 'removed') then
    insert into notifications (user_id, kind, title, body, ref_id)
    values (
      new.author_id,
      'post_' || new.status,
      case when new.status = 'published' then 'Seu post foi publicado' else 'Seu post não foi publicado' end,
      case when new.status = 'removed'
           then coalesce(nullif(btrim(new.moderator_note), ''), 'A moderação não informou o motivo.')
                || E'\n\nSeu post: "' || left(new.content, 120)
                || case when char_length(new.content) > 120 then '…"' else '"' end
           else left(new.content, 120) end,
      new.id
    );
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_post_decision() from public, anon, authenticated;

revoke execute on function public.send_post_to_review(uuid, text)                from public, anon;
revoke execute on function public.set_member_active(uuid, boolean, text)          from public, anon;
revoke execute on function public.unpublish_fact_check(uuid)                      from public, anon;
revoke execute on function public.promote_claim_check(uuid, text, check_result, text, text, text)
                                                                                    from public, anon;
grant execute on function public.send_post_to_review(uuid, text)                  to authenticated;
grant execute on function public.set_member_active(uuid, boolean, text)           to authenticated;
grant execute on function public.unpublish_fact_check(uuid)                       to authenticated;
grant execute on function public.promote_claim_check(uuid, text, check_result, text, text, text)
                                                                                    to authenticated;
