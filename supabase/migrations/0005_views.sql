-- Yvy — views de leitura.
--
-- Por que views e não SELECT direto: RLS filtra LINHA, nunca COLUNA. Se um
-- militante pudesse ler a linha de outro em `profiles`, leria também
-- full_name, phone e cep. Então `profiles` fica fechada e o que circula é
-- esta view, com as colunas que a seção 5.2 permite.

create view profiles_public
with (security_invoker = false) as   -- intencional: a view filtra, não o RLS
select p.id,
       p.display_name,
       p.role,
       p.membership_status,
       p.neighborhood,
       p.city,
       p.state,
       case when p.show_avatar then p.avatar_url end as avatar_url,
       p.created_at
  from profiles p
 where p.is_active
   and (
     p.id = auth.uid()
     or public.is_admin()
     or (
       public.is_militant_or_above()
       and (p.neighborhood, p.city) = (select neighborhood, city from public.my_area())
     )
   );

-- Ações com contagem de presença. security_invoker = true: quem decide quais
-- ações aparecem é o RLS de `actions`. A contagem vem de função DEFINER porque
-- `action_participants` só deixa cada um ver a própria linha.
create view actions_with_counts
with (security_invoker = true) as
select a.id, a.title, a.description, a.type, a.status, a.scheduled_at,
       a.location_name, a.lat, a.lng, a.neighborhood, a.city, a.state,
       a.max_participants, a.created_by, a.visibility, a.cancel_reason,
       a.created_at, a.updated_at,
       public.participant_count(a.id) as participant_count,
       public.display_name_of(a.created_by) as creator_display_name
  from actions a;

-- Feed com apelido do autor, pela mesma razão.
create view posts_with_author
with (security_invoker = true) as
select p.id, p.author_id, p.content, p.image_url, p.neighborhood, p.city,
       p.state, p.status, p.moderator_id, p.moderator_note, p.flagged_count,
       p.created_at,
       public.display_name_of(p.author_id) as author_display_name
  from posts p;

grant select on profiles_public, actions_with_counts, posts_with_author to authenticated;
