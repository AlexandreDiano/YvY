-- Ação nova no bairro vira aviso para quem é de lá (YVY-123).
--
-- Quem recebe é o mesmo público que a RLS deixa ver a ação
-- (actions_select_area): membro confirmado e ativo do mesmo bairro e cidade.
-- Fora quem criou e quem desligou "Ações do bairro" no Perfil
-- (profiles.notify_actions). Ação que já passou não avisa.
--
-- O aviso cai em `notifications`, então aparece em Avisos e, para quem ligou
-- "Avisos por e-mail", vai pelo notify-email (dentro do teto diário dele).
-- Texto: título, data e lugar da ação, que essas pessoas já podem ver no app.

create or replace function public.notify_action_open() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'open' or new.scheduled_at <= now() then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  insert into notifications (user_id, kind, title, body, ref_id)
  select p.id,
         'action_new',
         'Nova ação no seu bairro',
         new.title || E'\n'
           || to_char(new.scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI')
           || coalesce(' · ' || nullif(btrim(new.location_name), ''), '')
           || E'\n\nAbra para ver os detalhes e confirmar presença.',
         new.id
    from profiles p
   where p.neighborhood = new.neighborhood
     and p.city = new.city
     and p.id <> new.created_by
     and p.is_active
     and p.role in ('militant', 'moderator', 'admin')
     and p.membership_status = 'active'
     and p.notify_actions;
  return new;
end;
$$;
revoke execute on function public.notify_action_open() from public, anon, authenticated;

drop trigger if exists actions_notify_open on actions;
create trigger actions_notify_open
  after insert or update of status on actions
  for each row execute function public.notify_action_open();
