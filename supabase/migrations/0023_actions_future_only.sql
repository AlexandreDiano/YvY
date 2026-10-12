-- Yvy — ação só no futuro, com pelo menos 1h de antecedência.
--
-- O formulário já impede; isto vale também para quem usa a API direto com a
-- anon key do bundle. Tolerância de 5 min para relógio de celular adiantado
-- e tempo de preencher o formulário. Só na criação e quando a data muda —
-- ação antiga continua podendo ser cancelada/encerrada.

create or replace function public.check_action_schedule() returns trigger
language plpgsql set search_path = public as $$
begin
  if (tg_op = 'INSERT' or new.scheduled_at is distinct from old.scheduled_at)
     and new.scheduled_at < now() + interval '55 minutes' then
    raise exception 'A ação precisa ser marcada para daqui a pelo menos 1 hora.';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_action_schedule() from public, anon, authenticated;

drop trigger if exists trg_check_action_schedule on actions;
create trigger trg_check_action_schedule before insert or update of scheduled_at on actions
  for each row execute function public.check_action_schedule();
