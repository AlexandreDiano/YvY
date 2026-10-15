-- Seguir outra região imediata (pedido de 15/10). Quem mora em Foz do Iguaçu
-- e quer acompanhar Irati segue a região de Irati e passa a ler os posts de
-- região de lá. Postar continua só na própria região.
--
-- Até 5 regiões por pessoa: é para acompanhar lugares de que a pessoa
-- participa, não para ler o país inteiro (para isso existe o nível Brasil).

create table if not exists region_follows (
  user_id    uuid not null references profiles (id) on delete cascade,
  regiao_id  int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, regiao_id)
);

alter table region_follows enable row level security;
revoke all on region_follows from public, anon, authenticated;
grant select on region_follows to authenticated;
drop policy if exists region_follows_own on region_follows;
create policy region_follows_own on region_follows for select using (user_id = auth.uid());

/** Lista as regiões imediatas de uma UF, para escolher qual seguir. */
create or replace function public.list_regions(p_uf text)
returns table (regiao_id int, regiao_nome text, uf text, cidades int)
language sql stable security definer set search_path = public as $$
  select m.regiao_id, m.regiao_nome, m.uf, count(*)::int
    from municipios m
   where m.uf = upper(p_uf)
   group by m.regiao_id, m.regiao_nome, m.uf
   order by m.regiao_nome;
$$;

/** Regiões que a pessoa segue, com as cidades de cada uma. */
create or replace function public.my_followed_regions()
returns table (regiao_id int, regiao_nome text, uf text, cidades text[])
language sql stable security definer set search_path = public as $$
  select f.regiao_id, min(m.regiao_nome), min(m.uf), array_agg(m.nome order by m.nome)
    from region_follows f
    join municipios m on m.regiao_id = f.regiao_id
   where f.user_id = auth.uid()
   group by f.regiao_id
   order by min(m.regiao_nome);
$$;

create or replace function public.follow_region(p_regiao int, p_follow boolean)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_militant_or_above() then
    raise exception 'Só membro confirmado segue região.' using errcode = '42501';
  end if;
  if not p_follow then
    delete from region_follows where user_id = auth.uid() and regiao_id = p_regiao;
    return;
  end if;
  if not exists (select 1 from municipios where regiao_id = p_regiao) then
    raise exception 'Região não encontrada.';
  end if;
  if (select count(*) from region_follows where user_id = auth.uid()) >= 5 then
    raise exception 'Dá para seguir até 5 regiões. Deixe de seguir uma antes.';
  end if;
  insert into region_follows (user_id, regiao_id) values (auth.uid(), p_regiao)
  on conflict do nothing;
end;
$$;

/** A pessoa logada segue a região imediata desta cidade? */
create or replace function public.follows_region_of(p_city text, p_uf text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from region_follows f
     where f.user_id = auth.uid()
       and f.regiao_id = public.region_of_city(p_city, p_uf)
  );
$$;

revoke execute on function public.list_regions(text)             from public, anon;
revoke execute on function public.my_followed_regions()          from public, anon;
revoke execute on function public.follow_region(int, boolean)    from public, anon;
revoke execute on function public.follows_region_of(text, text)  from public, anon;
grant execute on function public.list_regions(text)              to authenticated;
grant execute on function public.my_followed_regions()           to authenticated;
grant execute on function public.follow_region(int, boolean)     to authenticated;
grant execute on function public.follows_region_of(text, text)   to authenticated;

drop policy if exists posts_select_feed on posts;
create policy posts_select_feed on posts
  for select using (
    status = 'published'
    and public.is_militant_or_above()
    and (
      (scope = 'bairro' and (neighborhood, city) = (select neighborhood, city from public.my_area()))
      or (scope = 'regiao_imediata'
          and (public.same_region(city, state, (select city from public.my_area()), public.my_state())
               or public.follows_region_of(city, state)))
      or (scope = 'regiao' and public.region_of(state) = public.region_of(public.my_state()))
      or scope = 'brasil'
    )
  );
