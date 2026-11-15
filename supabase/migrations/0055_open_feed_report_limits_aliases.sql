-- Três mudanças pedidas em 06/11:
--
-- 1. Post do bairro publica na hora. Acabam as 2 horas de espera
--    (auto_approve_posts, 0021): quem cuida do feed é a comunidade, que
--    denuncia, e 3 denúncias tiram o post do ar até a moderação olhar (0004).
--    Post de região e de Brasil continua passando pela moderação.
-- 2. Trava contra quem denuncia demais (post ou conversa). Passou do limite,
--    a denúncia é recusada com aviso; ao bater o limite do dia, a equipe
--    (admin) recebe um aviso e fica registrado no audit_log.
-- 3. Apelido próprio para um contato aceito das Conversas: só quem deu vê, e
--    é com ele que essa pessoa vê o contato nos posts e nas conversas.

-- ------------------------------------------------------------------ 1. feed

create or replace function public.posts_publish_bairro() returns trigger
language plpgsql set search_path = public as $$
begin
  -- o app antigo ainda manda 'pending'; no bairro vira publicado na hora.
  -- Só post de pessoa logada: script e service_role continuam podendo criar
  -- post pendente (testes da fila de moderação).
  if new.scope = 'bairro' and new.status = 'pending' and auth.uid() is not null then
    new.status := 'published';
  end if;
  return new;
end;
$$;
revoke execute on function public.posts_publish_bairro() from public, anon, authenticated;

drop trigger if exists posts_publish_bairro on posts;
create trigger posts_publish_bairro before insert on posts
  for each row execute function public.posts_publish_bairro();

-- a RLS confere a linha depois do trigger: no bairro ela chega 'published'
drop policy if exists posts_insert_militant on posts;
create policy posts_insert_militant on posts
  for insert with check (
    public.is_militant_or_above()
    and author_id = auth.uid()
    and status = (case when scope = 'bairro' then 'published' else 'pending' end)::post_status
    and (neighborhood, city) = (select neighborhood, city from public.my_area())
    and state = public.my_state()
  );

-- o que estava esperando as 2 horas sai agora
update posts set status = 'published' where status = 'pending' and scope = 'bairro';

do $$
begin
  if exists (select 1 from cron.job where jobname = 'auto-approve-posts') then
    perform cron.unschedule('auto-approve-posts');
  end if;
end;
$$;
drop function if exists public.auto_approve_posts();

-- ------------------------------------------------------- 2. denúncia demais

-- Limites por pessoa. Uma hora pega rajada; o dia pega o "denuncia tudo".
create or replace function public.report_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_who   uuid;
  v_kind  text;
  v_hour  int;
  v_day   int;
  v_max_h int;
  v_max_d int;
begin
  if tg_table_name = 'post_flags' then
    v_who := new.flagger_id; v_kind := 'posts'; v_max_h := 5; v_max_d := 15;
    select count(*) filter (where created_at > now() - interval '1 hour'),
           count(*)
      into v_hour, v_day
      from post_flags where flagger_id = v_who and created_at > now() - interval '1 day';
  else
    v_who := new.reporter; v_kind := 'conversas'; v_max_h := 3; v_max_d := 6;
    select count(*) filter (where created_at > now() - interval '1 hour'),
           count(*)
      into v_hour, v_day
      from chat_reports where reporter = v_who and created_at > now() - interval '1 day';
  end if;

  if v_hour >= v_max_h or v_day >= v_max_d then
    raise exception 'Você fez muitas denúncias de % em pouco tempo. Espere um pouco; se for urgente, fale com a moderação.', v_kind
      using errcode = 'P0001';
  end if;

  -- esta é a última que passa hoje: avisa a equipe uma vez
  if v_day + 1 = v_max_d then
    insert into audit_log (user_id, action, entity_type, entity_id, metadata)
    values (v_who, 'report_burst', tg_table_name, v_who,
            jsonb_build_object('actor_name', public.display_name_of(v_who), 'kind', v_kind, 'in_24h', v_day + 1));
    insert into notifications (user_id, kind, title, body, ref_id)
    select p.id, 'report_burst', 'Muitas denúncias de uma pessoa',
           public.display_name_of(v_who) || ' fez ' || (v_day + 1) || ' denúncias de ' || v_kind
             || ' em 24 horas. Vale olhar se não é perseguição ou engano. Em Membros dá para suspender a conta.',
           v_who
      from profiles p
     where p.role = 'admin' and p.is_active and p.id <> v_who;
  end if;
  return new;
end;
$$;
revoke execute on function public.report_guard() from public, anon, authenticated;

drop trigger if exists post_flags_guard on post_flags;
create trigger post_flags_guard before insert on post_flags
  for each row execute function public.report_guard();

drop trigger if exists chat_reports_guard on chat_reports;
create trigger chat_reports_guard before insert on chat_reports
  for each row execute function public.report_guard();

-- ------------------------------------------------------ 3. apelido do amigo

create table if not exists contact_aliases (
  owner_id   uuid not null references profiles(id) on delete cascade,
  contact_id uuid not null references profiles(id) on delete cascade,
  alias      text not null check (char_length(btrim(alias)) between 1 and 30),
  updated_at timestamptz not null default now(),
  primary key (owner_id, contact_id),
  check (owner_id <> contact_id)
);
alter table contact_aliases enable row level security;
revoke all on contact_aliases from public, anon, authenticated;
grant select, delete on contact_aliases to authenticated;

-- só quem deu o apelido vê
create policy contact_aliases_select_own on contact_aliases
  for select using (owner_id = auth.uid());
create policy contact_aliases_delete_own on contact_aliases
  for delete using (owner_id = auth.uid());

/** Dá (ou tira, com texto vazio) o apelido de um contato aceito. */
create or replace function public.set_contact_alias(p_contact uuid, p_alias text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me    uuid := auth.uid();
  v_alias text := nullif(btrim(coalesce(p_alias, '')), '');
begin
  if v_me is null then
    raise exception 'Entre na sua conta.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from chat_contacts c
     where c.status = 'accepted'
       and c.user_a = least(v_me, p_contact) and c.user_b = greatest(v_me, p_contact)
  ) then
    raise exception 'Só dá para dar apelido a quem já está nas suas conversas.' using errcode = 'P0001';
  end if;
  if v_alias is null then
    delete from contact_aliases where owner_id = v_me and contact_id = p_contact;
    return;
  end if;
  if char_length(v_alias) > 30 then
    raise exception 'O apelido pode ter até 30 letras.' using errcode = 'P0001';
  end if;
  insert into contact_aliases (owner_id, contact_id, alias)
  values (v_me, p_contact, v_alias)
  on conflict (owner_id, contact_id) do update set alias = excluded.alias, updated_at = now();
end;
$$;
revoke execute on function public.set_contact_alias(uuid, text) from public, anon;
grant execute on function public.set_contact_alias(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'audit_attach') then
    perform public.audit_attach('contact_aliases');
  end if;
end;
$$;
