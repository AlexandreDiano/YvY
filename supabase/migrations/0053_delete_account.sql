-- Yvy — apagar a própria conta pelo app (YVY-137, LGPD art. 18, VI).
--
-- A RPC delete_my_account apaga a linha de auth.users da própria pessoa, e o
-- cascade das FKs leva o resto. O que acontece com cada dado (levantado das
-- FKs para profiles e auth.users em 05/11):
--
-- Sai junto com a conta (on delete cascade):
--   - profiles (a linha inteira: nome, telefone, CEP, bairro, apelido);
--   - posts que a pessoa escreveu, denúncias de post que ela fez
--     (post_flags), ideias e problemas (feedback), avisos (notifications),
--     regiões seguidas, linha de moderador, permissão de convidar
--     (invite_grants) e de mudar papéis (role_managers) que ela TINHA;
--   - presenças em ação (action_participants);
--   - ações que ela criou, inclusive as futuras com outras pessoas
--     confirmadas. Manter a ação sem dono deixaria um ponto de encontro sem
--     ninguém responsável; e guardar menos é o caminho quando a escolha não é
--     óbvia. Quem tinha confirmado presença numa ação futura recebe um aviso
--     (só o título da ação) antes de ela sumir;
--   - convites que ela gerou (invites) e, com eles, as reservas pendentes
--     (invite_claims): quem escaneou e ainda não se cadastrou perde a vaga;
--   - conversas: aparelhos e chaves públicas, contatos, bloqueios (feitos e
--     recebidos), códigos de adicionar e mensagens cifradas ainda na fila.
--
-- Fica, sem apontar para ninguém (on delete set null):
--   - profiles.invited_by de quem ela convidou. Convidado ainda pendente só
--     pode ser confirmado pelo admin depois disso (decide_invitee);
--   - invites.used_by, invite_claims.redeemed_by, posts.moderator_id,
--     claim_checks.reviewed_by, plan_promise_updates.created_by;
--   - invite_grants.granted_by e role_managers.granted_by: eram NO ACTION e
--     NOT NULL, o que travava a exclusão de quem já liberou convite ou papel
--     para alguém. Agora viram null e a permissão da outra pessoa continua.
--
-- Fica, por não ter FK, cada um com a própria retenção:
--   - audit_log: 6 meses (0048). O registro da exclusão em si guarda as
--     linhas apagadas, como toda exclusão, para servir de prova, MENOS o que
--     é dado pessoal do perfil: nome completo, telefone, e-mail, CEP e foto
--     saem da cópia da linha de profiles (ver audit_row abaixo). O apelido e
--     o bairro ficam, que já circulavam entre pessoas;
--   - chat_access_log: IP de quem mandou mensagem, 6 meses (0050);
--   - chat_reports: denúncia em que a pessoa aparece segue a regra da
--     denúncia (apagada 6 meses depois de resolvida). Apagar a conta não
--     apaga denúncia contra si.
--
-- Fora do banco: as imagens dos posts ficam no Storage (post-images/<uid>/)
-- e o SQL não pode apagar arquivo de lá. O app apaga antes de chamar a RPC
-- (policy post_images_delete_own); ver deleteAccount em AuthProvider.
--
-- Admin não apaga a conta pelo app: papel de admin só muda pelo SQL Editor
-- (CLAUDE.md), e sumir com o único admin trancaria a moderação.

-- ------------------------------------------------------------
-- granted_by: NO ACTION -> set null
-- ------------------------------------------------------------
do $$
declare
  t text;
  c text;
begin
  foreach t in array array['invite_grants', 'role_managers'] loop
    select conname into c
      from pg_constraint
     where conrelid = format('public.%I', t)::regclass
       and contype = 'f'
       and conkey = array[(select attnum from pg_attribute
                            where attrelid = format('public.%I', t)::regclass
                              and attname = 'granted_by')];
    if c is not null then
      execute format('alter table public.%I drop constraint %I', t, c);
    end if;
    execute format('alter table public.%I alter column granted_by drop not null', t);
    execute format(
      'alter table public.%I add constraint %I foreign key (granted_by) references public.profiles(id) on delete set null',
      t, t || '_granted_by_fkey');
  end loop;
end $$;

-- audit_row: o filtro da exclusão de conta (yvy.deleting_account e
-- yvy.actor_name, ligados pela RPC abaixo) fica na própria 0048, que ainda
-- está em espera na produção. Se ficasse aqui, a 0048 aplicada depois
-- sobrescreveria a função e a cópia do perfil apagado voltaria a levar nome,
-- telefone e CEP. Sem a 0048, os set_config abaixo não fazem nada.


-- ------------------------------------------------------------
-- RPC
-- ------------------------------------------------------------
create or replace function public.delete_my_account(p_confirm text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_me profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Sem sessão.' using errcode = '42501';
  end if;
  -- a confirmação dupla é do app; aqui só barra chamada sem querer
  if upper(btrim(coalesce(p_confirm, ''))) <> 'APAGAR' then
    raise exception 'Confirmação inválida. Digite APAGAR.' using errcode = '22023';
  end if;

  select * into v_me from profiles where id = v_uid;
  if found and v_me.role = 'admin' then
    raise exception 'Conta de admin não é apagada pelo app. Peça a outro admin.' using errcode = '42501';
  end if;

  -- Ações futuras dela saem no cascade: avisa quem tinha confirmado presença.
  insert into notifications (user_id, kind, title, body, ref_id)
  select p.user_id, 'action_cancelled',
         'Ação cancelada: ' || a.title,
         'Quem criou a ação apagou a conta, e a ação saiu da agenda.',
         null
    from actions a
    join action_participants p on p.action_id = a.id
   where a.created_by = v_uid
     and a.scheduled_at > now()
     and a.status in ('open', 'confirmed')
     and p.user_id <> v_uid
     and p.status <> 'cancelled';

  -- só colunas que a produção já tem (0003): actor_name e request_inet()
  -- são da 0048, que está em espera
  insert into audit_log (user_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'delete_account', 'profile', v_uid,
          jsonb_strip_nulls(jsonb_build_object('actor_name', v_me.display_name,
                                               'neighborhood', v_me.neighborhood, 'city', v_me.city,
                                               'state', v_me.state, 'role', v_me.role)));

  perform set_config('yvy.deleting_account', 'on', true);
  perform set_config('yvy.actor_name', coalesce(v_me.display_name, ''), true);

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;
