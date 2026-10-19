-- Yvy — conversa 1:1 com criptografia de ponta a ponta (decisão de 19/10).
--
-- O servidor nunca vê o texto. Cada aparelho gera um par de chaves de
-- cifra (X25519) e um de assinatura (Ed25519) com libsodium; a parte privada
-- fica no cofre do aparelho e a pública vem para chat_devices. Quem envia
-- cifra uma cópia para cada aparelho do destinatário (crypto_box) e assina a
-- mensagem, para a denúncia poder provar quem escreveu.
--
--   chat_add_codes   código/QRCode de "adicionar", 10 min
--   chat_contacts    pedido de conversa; só "accepted" deixa mandar mensagem
--   chat_blocks      bloqueio (vale nos dois sentidos para envio)
--   message_queue    fila só com texto cifrado; o destinatário apaga ao
--                    baixar, e o que sobrar some em 7 dias
--   chat_access_log  IP de quem envia (sem conteúdo nem destinatário), para
--                    a denúncia; 6 meses (Marco Civil art. 15)
--   chat_reports     denúncia: as últimas mensagens que QUEM DENUNCIA decifrou
--                    no próprio aparelho, as chaves de assinatura das duas
--                    partes no momento e os IPs. Só moderador do bairro de
--                    quem foi denunciado e admin leem.
--
-- Não depende da 0048 (auditoria total, em espera): IP vem de request_ip()
-- (0037) e o audit_attach só roda se a 0048 já estiver aplicada.

-- ------------------------------------------------------------
-- Tabelas
-- ------------------------------------------------------------
create table if not exists chat_devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  box_pk       text not null unique check (length(box_pk) between 40 and 64),
  sign_pk      text not null unique check (length(sign_pk) between 40 and 64),
  created_at   timestamptz not null default now()
);
create index if not exists idx_chat_devices_user on chat_devices (user_id);

create table if not exists chat_add_codes (
  code        text primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  expires_at  timestamptz not null,
  uses        int not null default 0
);
create index if not exists idx_chat_add_codes_user on chat_add_codes (user_id);

create table if not exists chat_contacts (
  id            uuid primary key default gen_random_uuid(),
  user_a        uuid not null references profiles(id) on delete cascade,
  user_b        uuid not null references profiles(id) on delete cascade,
  requested_by  uuid not null references profiles(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  check (user_a < user_b),
  unique (user_a, user_b)
);
create index if not exists idx_chat_contacts_b on chat_contacts (user_b);

create table if not exists chat_blocks (
  blocker     uuid not null references profiles(id) on delete cascade,
  blocked     uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index if not exists idx_chat_blocks_blocked on chat_blocks (blocked);

create table if not exists message_queue (
  id                uuid primary key default gen_random_uuid(),
  msg_id            uuid not null,
  sender            uuid not null references profiles(id) on delete cascade,
  sender_device     uuid not null references chat_devices(id) on delete cascade,
  recipient         uuid not null references profiles(id) on delete cascade,
  recipient_device  uuid not null references chat_devices(id) on delete cascade,
  nonce             text not null check (length(nonce) between 20 and 64),
  body              text not null check (length(body) between 1 and 12000),
  created_at        timestamptz not null default now(),
  unique (msg_id, recipient_device)
);
create index if not exists idx_message_queue_inbox on message_queue (recipient_device, created_at);
create index if not exists idx_message_queue_sender on message_queue (sender, created_at);

create table if not exists chat_access_log (
  user_id     uuid not null,
  ip          text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_chat_access_log on chat_access_log (user_id, created_at desc);

create table if not exists chat_reports (
  id                    uuid primary key default gen_random_uuid(),
  -- sem FK: a denúncia fica mesmo se alguém apagar a conta
  reporter              uuid not null,
  reporter_name         text,
  reported              uuid not null,
  reported_name         text,
  reported_neighborhood text,
  reported_city         text,
  messages              jsonb not null,
  sign_keys             jsonb not null,
  reporter_ip           text,
  reported_ips          jsonb not null default '[]',
  blocked               boolean not null default false,
  status                text not null default 'open' check (status in ('open', 'resolved')),
  resolution            text,
  resolved_by           uuid,
  resolved_at           timestamptz,
  created_at            timestamptz not null default now()
);
create index if not exists idx_chat_reports_area on chat_reports (reported_city, reported_neighborhood, status);

-- ------------------------------------------------------------
-- Acesso: tudo fechado, depois só o necessário
-- ------------------------------------------------------------
alter table chat_devices    enable row level security;
alter table chat_add_codes  enable row level security;
alter table chat_contacts   enable row level security;
alter table chat_blocks     enable row level security;
alter table message_queue   enable row level security;
alter table chat_access_log enable row level security;
alter table chat_reports    enable row level security;

revoke all on chat_devices, chat_add_codes, chat_contacts, chat_blocks,
              message_queue, chat_access_log, chat_reports
  from public, anon, authenticated;

-- aparelho: cada um registra e apaga os próprios; chave dos outros só por RPC
grant select, insert, delete on chat_devices to authenticated;
create policy chat_devices_own_select on chat_devices for select to authenticated
  using (user_id = auth.uid());
create policy chat_devices_own_insert on chat_devices for insert to authenticated
  with check (user_id = auth.uid() and public.is_militant_or_above());
create policy chat_devices_own_delete on chat_devices for delete to authenticated
  using (user_id = auth.uid());

grant select on chat_contacts to authenticated;
create policy chat_contacts_party on chat_contacts for select to authenticated
  using (auth.uid() in (user_a, user_b));

grant select on chat_blocks to authenticated;
create policy chat_blocks_own on chat_blocks for select to authenticated
  using (blocker = auth.uid());

grant select on chat_reports to authenticated;
create policy chat_reports_staff on chat_reports for select to authenticated
  using (public.is_moderator_for(reported_neighborhood, reported_city));

-- Pode mandar de p_from para p_to? Contato aceito, ninguém bloqueou ninguém
-- e as duas contas ativas.
create or replace function public.chat_can_send(p_from uuid, p_to uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from chat_contacts c
       where c.user_a = least(p_from, p_to) and c.user_b = greatest(p_from, p_to)
         and c.status = 'accepted')
     and not exists (
      select 1 from chat_blocks b
       where (b.blocker = p_from and b.blocked = p_to) or (b.blocker = p_to and b.blocked = p_from))
     and exists (select 1 from profiles where id = p_to and is_active)
     and exists (select 1 from profiles where id = p_from and is_active);
$$;
revoke execute on function public.chat_can_send(uuid, uuid) from public, anon;

-- Os dois aparelhos são de quem diz ser. DEFINER porque quem envia não
-- enxerga (pela RLS) o aparelho do destinatário.
create or replace function public.chat_devices_match(p_from_dev uuid, p_from uuid, p_to_dev uuid, p_to uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_devices where id = p_from_dev and user_id = p_from)
     and exists (select 1 from chat_devices where id = p_to_dev and user_id = p_to);
$$;
revoke execute on function public.chat_devices_match(uuid, uuid, uuid, uuid) from public, anon;

-- A fila: o remetente só insere (não lê de volta); o destinatário lê e apaga.
grant select, insert, delete on message_queue to authenticated;
create policy message_queue_send on message_queue for insert to authenticated
  with check (
    sender = auth.uid()
    and public.is_militant_or_above()
    and public.chat_can_send(sender, recipient)
    and public.chat_devices_match(sender_device, sender, recipient_device, recipient)
  );
create policy message_queue_inbox on message_queue for select to authenticated
  using (recipient = auth.uid());
create policy message_queue_ack on message_queue for delete to authenticated
  using (recipient = auth.uid());

-- ------------------------------------------------------------
-- Gatilhos
-- ------------------------------------------------------------
create or replace function public.chat_client_ip() returns text
language plpgsql stable set search_path = public as $$
declare
  v_xff text;
begin
  if public.request_ip() is not null then
    return public.request_ip();
  end if;
  -- sem cf-connecting-ip: a cadeia crua, marcada (o primeiro item pode ser forjado)
  v_xff := nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for';
  return case when v_xff is not null then 'xff:' || left(v_xff, 200) end;
exception when others then
  return null;
end;
$$;
revoke execute on function public.chat_client_ip() from public, anon, authenticated;

create or replace function public.chat_queue_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ip text := public.chat_client_ip();
begin
  -- até 120 cópias por minuto (mensagem × aparelhos do destinatário)
  if (select count(*) from message_queue
       where sender = new.sender and created_at > now() - interval '1 minute') >= 120 then
    raise exception 'Muitas mensagens seguidas. Espere um pouco.' using errcode = 'P0001';
  end if;
  if v_ip is not null and not exists (
      select 1 from chat_access_log
       where user_id = new.sender and ip = v_ip and created_at > now() - interval '1 hour') then
    insert into chat_access_log (user_id, ip) values (new.sender, v_ip);
  end if;
  new.created_at := now();
  return new;
end;
$$;
revoke execute on function public.chat_queue_guard() from public, anon, authenticated;
drop trigger if exists chat_queue_guard on message_queue;
create trigger chat_queue_guard before insert on message_queue
  for each row execute function public.chat_queue_guard();

create or replace function public.chat_devices_cap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from chat_devices where user_id = new.user_id) >= 5 then
    raise exception 'Limite de 5 aparelhos. Saia de um aparelho antigo no Perfil.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.chat_devices_cap() from public, anon, authenticated;
drop trigger if exists chat_devices_cap on chat_devices;
create trigger chat_devices_cap before insert on chat_devices
  for each row execute function public.chat_devices_cap();

-- ------------------------------------------------------------
-- RPCs
-- ------------------------------------------------------------

-- Código de "adicionar" (vai no QRCode). Troca o anterior; vale 10 min e até
-- 20 pedidos, e cada pedido ainda precisa ser aceito.
create or replace function public.chat_new_add_code()
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code text;
  v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_until timestamptz := now() + interval '10 minutes';
begin
  if not public.is_militant_or_above() then
    raise exception 'Só membro confirmado da base conversa por aqui.' using errcode = '42501';
  end if;
  delete from chat_add_codes c where c.user_id = auth.uid();
  loop
    select string_agg(substr(v_alpha, 1 + (get_byte(b, i) % 32), 1), '')
      into v_code
      from (select gen_random_bytes(10) as b) r, generate_series(0, 9) i;
    exit when not exists (select 1 from chat_add_codes c where c.code = v_code);
  end loop;
  insert into chat_add_codes (code, user_id, expires_at) values (v_code, auth.uid(), v_until);
  return query select v_code, v_until;
end;
$$;
revoke execute on function public.chat_new_add_code() from public, anon;
grant execute on function public.chat_new_add_code() to authenticated;

-- Quem leu o código pede para conversar; o dono do código aceita ou recusa.
create or replace function public.chat_request_contact(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_owner uuid;
  v_id uuid;
  v_status text;
begin
  if not public.is_militant_or_above() then
    raise exception 'Só membro confirmado da base conversa por aqui.' using errcode = '42501';
  end if;
  if (select count(*) from chat_contacts
       where requested_by = v_me and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Muitos pedidos hoje. Tente amanhã.' using errcode = 'P0001';
  end if;

  update chat_add_codes c set uses = uses + 1
   where c.code = upper(btrim(p_code)) and c.expires_at > now() and c.uses < 20
  returning c.user_id into v_owner;
  if v_owner is null then
    raise exception 'Código inválido ou vencido. Peça um novo.' using errcode = 'P0001';
  end if;
  if v_owner = v_me then
    raise exception 'Esse código é o seu.' using errcode = 'P0001';
  end if;
  if exists (select 1 from chat_blocks
              where (blocker = v_me and blocked = v_owner) or (blocker = v_owner and blocked = v_me)) then
    raise exception 'Não foi possível adicionar essa pessoa.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from profiles where id = v_owner and is_active) then
    raise exception 'Código inválido ou vencido. Peça um novo.' using errcode = 'P0001';
  end if;

  select id, status into v_id, v_status from chat_contacts
   where user_a = least(v_me, v_owner) and user_b = greatest(v_me, v_owner);
  if v_id is null then
    insert into chat_contacts (user_a, user_b, requested_by)
    values (least(v_me, v_owner), greatest(v_me, v_owner), v_me)
    returning id into v_id;
  elsif v_status = 'declined' then
    update chat_contacts set status = 'pending', requested_by = v_me, created_at = now(), decided_at = null
     where id = v_id;
  else
    return v_id; -- já pendente ou aceito
  end if;

  insert into notifications (user_id, kind, title, body, ref_id)
  values (v_owner, 'chat_request', 'Pedido de conversa',
          'Camarada ' || coalesce((select display_name from profiles where id = v_me), '') ||
          ' quer conversar com você. Aceite ou recuse em Conversas.', v_id);
  return v_id;
end;
$$;
revoke execute on function public.chat_request_contact(text) from public, anon;
grant execute on function public.chat_request_contact(text) to authenticated;

create or replace function public.chat_decide_contact(p_contact uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update chat_contacts
     set status = case when p_accept then 'accepted' else 'declined' end, decided_at = now()
   where id = p_contact and status = 'pending'
     and auth.uid() in (user_a, user_b) and requested_by <> auth.uid();
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.chat_decide_contact(uuid, boolean) from public, anon;
grant execute on function public.chat_decide_contact(uuid, boolean) to authenticated;

-- Contatos e pedidos de quem chama, com apelido e bairro da outra pessoa.
create or replace function public.chat_contacts_list()
returns table (contact_id uuid, peer_id uuid, peer_name text, peer_neighborhood text, peer_city text,
               status text, incoming boolean, blocked boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, p.id, p.display_name, p.neighborhood, p.city, c.status,
         c.requested_by <> auth.uid(),
         exists (select 1 from chat_blocks b where b.blocker = auth.uid() and b.blocked = p.id),
         c.created_at
    from chat_contacts c
    join profiles p on p.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
   where auth.uid() in (c.user_a, c.user_b) and c.status <> 'declined'
   order by c.created_at desc;
$$;
revoke execute on function public.chat_contacts_list() from public, anon;
grant execute on function public.chat_contacts_list() to authenticated;

-- Chaves públicas dos aparelhos de alguém: de si mesmo ou de contato aceito.
create or replace function public.chat_peer_devices(p_peer uuid)
returns table (id uuid, box_pk text, sign_pk text)
language sql stable security definer set search_path = public as $$
  select d.id, d.box_pk, d.sign_pk
    from chat_devices d
   where d.user_id = p_peer
     and (p_peer = auth.uid() or exists (
       select 1 from chat_contacts c
        where c.user_a = least(auth.uid(), p_peer) and c.user_b = greatest(auth.uid(), p_peer)
          and c.status = 'accepted'))
   order by d.created_at;
$$;
revoke execute on function public.chat_peer_devices(uuid) from public, anon;
grant execute on function public.chat_peer_devices(uuid) to authenticated;

create or replace function public.chat_block(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user = auth.uid() or auth.uid() is null then
    raise exception 'Não dá para bloquear essa conta.' using errcode = 'P0001';
  end if;
  insert into chat_blocks (blocker, blocked) values (auth.uid(), p_user) on conflict do nothing;
  -- o que ela já tinha mandado e eu ainda não baixei some
  delete from message_queue where recipient = auth.uid() and sender = p_user;
end;
$$;
revoke execute on function public.chat_block(uuid) from public, anon;
grant execute on function public.chat_block(uuid) to authenticated;

create or replace function public.chat_unblock(p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from chat_blocks where blocker = auth.uid() and blocked = p_user;
$$;
revoke execute on function public.chat_unblock(uuid) from public, anon;
grant execute on function public.chat_unblock(uuid) to authenticated;

create or replace function public.chat_blocked_list()
returns table (peer_id uuid, peer_name text, peer_neighborhood text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.neighborhood, b.created_at
    from chat_blocks b join profiles p on p.id = b.blocked
   where b.blocker = auth.uid()
   order by b.created_at desc;
$$;
revoke execute on function public.chat_blocked_list() from public, anon;
grant execute on function public.chat_blocked_list() to authenticated;

-- Denúncia. p_messages: até 30 itens {id, from, at, env, sig, dev} que o
-- aparelho de quem denuncia decifrou. O servidor acrescenta o que só ele
-- sabe: IP de quem denuncia agora, IPs recentes de quem foi denunciado e as
-- chaves de assinatura das duas partes (a moderação confere cada mensagem).
create or replace function public.chat_report(p_reported uuid, p_messages jsonb, p_block boolean)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_target profiles;
begin
  if v_me is null or p_reported = v_me then
    raise exception 'Denúncia inválida.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from chat_contacts
                  where user_a = least(v_me, p_reported) and user_b = greatest(v_me, p_reported)) then
    raise exception 'Só dá para denunciar quem conversou com você.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_messages) <> 'array' or jsonb_array_length(p_messages) > 30
     or length(p_messages::text) > 200000 then
    raise exception 'Denúncia grande demais.' using errcode = 'P0001';
  end if;
  if (select count(*) from chat_reports where reporter = v_me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Muitas denúncias hoje. A moderação já está vendo.' using errcode = 'P0001';
  end if;

  select * into v_target from profiles where id = p_reported;

  insert into chat_reports (reporter, reporter_name, reported, reported_name,
                            reported_neighborhood, reported_city, messages, sign_keys,
                            reporter_ip, reported_ips, blocked)
  values (
    v_me,
    (select display_name from profiles where id = v_me),
    p_reported, v_target.display_name, v_target.neighborhood, v_target.city,
    p_messages,
    coalesce((select jsonb_object_agg(d.id, jsonb_build_object('user', d.user_id, 'sign_pk', d.sign_pk))
                from chat_devices d where d.user_id in (v_me, p_reported)), '{}'),
    public.chat_client_ip(),
    coalesce((select jsonb_agg(jsonb_build_object('ip', ip, 'last_seen', last_seen) order by last_seen desc)
                from (select ip, max(created_at) as last_seen from chat_access_log
                       where user_id = p_reported and created_at > now() - interval '30 days'
                       group by ip order by 2 desc limit 10) x), '[]'),
    coalesce(p_block, false))
  returning id into v_id;

  if p_block then
    perform public.chat_block(p_reported);
  end if;

  insert into audit_log (user_id, action, entity_type, entity_id, metadata)
  values (v_me, 'chat_report', 'chat_reports', v_id, jsonb_build_object('reported', p_reported, 'blocked', p_block));

  insert into notifications (user_id, kind, title, body, ref_id)
  select distinct u, 'chat_report', 'Denúncia de conversa',
         'Uma conversa foi denunciada no bairro ' || coalesce(v_target.neighborhood, '?') || '. Veja em Moderar.', v_id
    from (select id as u from profiles where role = 'admin' and is_active
          union
          select m.user_id from moderators m
           where m.is_active and m.neighborhood = v_target.neighborhood and m.city = v_target.city) s
   where u <> p_reported;
  return v_id;
end;
$$;
revoke execute on function public.chat_report(uuid, jsonb, boolean) from public, anon;
grant execute on function public.chat_report(uuid, jsonb, boolean) to authenticated;

create or replace function public.chat_resolve_report(p_id uuid, p_resolution text) returns void
language plpgsql security definer set search_path = public as $$
declare
  r chat_reports;
begin
  select * into r from chat_reports where id = p_id;
  if r.id is null or not public.is_moderator_for(r.reported_neighborhood, r.reported_city) then
    raise exception 'Sem permissão para esta denúncia.' using errcode = '42501';
  end if;
  update chat_reports
     set status = 'resolved', resolution = left(btrim(p_resolution), 1000),
         resolved_by = auth.uid(), resolved_at = now()
   where id = p_id;
  insert into audit_log (user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'chat_report_resolved', 'chat_reports', p_id,
          jsonb_build_object('resolution', left(btrim(p_resolution), 1000)));
end;
$$;
revoke execute on function public.chat_resolve_report(uuid, text) from public, anon;
grant execute on function public.chat_resolve_report(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- Limpeza: fila 7 dias, código vencido, IP 6 meses, denúncia resolvida 6 meses
-- ------------------------------------------------------------
create or replace function public.chat_purge() returns void
language sql security definer set search_path = public as $$
  delete from message_queue   where created_at < now() - interval '7 days';
  delete from chat_add_codes  where expires_at < now();
  delete from chat_access_log where created_at < now() - interval '6 months';
  delete from chat_reports    where status = 'resolved' and resolved_at < now() - interval '6 months';
$$;
revoke execute on function public.chat_purge() from public, anon, authenticated;
select cron.schedule('chat-purge', '35 * * * *', $$select public.chat_purge()$$);

-- ------------------------------------------------------------
-- Realtime (aviso de mensagem nova; a RLS vale também aqui), auditoria, flag
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and tablename = 'message_queue') then
    alter publication supabase_realtime add table message_queue;
  end if;
end $$;

-- Fila (texto cifrado que some), IP e código ficam fora do log; a denúncia
-- já grava o próprio registro sem repetir as mensagens.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'audit_attach') then
    perform public.audit_attach('chat_devices');
    perform public.audit_attach('chat_contacts');
    perform public.audit_attach('chat_blocks');
  end if;
end $$;

-- Desligado na produção até a revisão jurídica (YVY-74); o seed local liga.
insert into feature_flags (key, is_enabled, description)
values ('module_chat', false, 'Conversas 1:1 com criptografia de ponta a ponta')
on conflict (key) do nothing;
