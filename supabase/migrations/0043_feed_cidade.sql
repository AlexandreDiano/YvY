-- Feed da Base: o nível "estado" vira "cidade" (decisão de 15/10).
-- Os níveis ficam bairro, cidade, região e Brasil. Post de cidade circula
-- para quem mora na mesma cidade (e mesma UF, porque nome de cidade se repete
-- entre estados). A moderação não muda: fora do bairro, só admin aprova, e
-- a auto-aprovação de 2h continua valendo só para bairro.
--
-- Quando esta migration foi escrita não havia nenhum post de estado.
-- Se houver, ele vira de cidade, que circula para menos gente.

alter table posts drop constraint if exists posts_scope_check;
update posts set scope = 'cidade' where scope = 'estado';
alter table posts add constraint posts_scope_check
  check (scope in ('bairro', 'cidade', 'regiao', 'brasil'));

drop policy if exists posts_select_feed on posts;
create policy posts_select_feed on posts
  for select using (
    status = 'published'
    and public.is_militant_or_above()
    and (
      (scope = 'bairro' and (neighborhood, city) = (select neighborhood, city from public.my_area()))
      or (scope = 'cidade' and city = (select city from public.my_area()) and state = public.my_state())
      or (scope = 'regiao' and public.region_of(state) = public.region_of(public.my_state()))
      or scope = 'brasil'
    )
  );
