-- Yvy — enums.

create type user_role as enum ('visitor', 'militant', 'moderator', 'admin');

-- Separa PAPEL de SITUAÇÃO: o contexto (4.2, passo 8) fala de role='militant'
-- com status='pending', o que não cabia num enum só de papel.
create type membership_status as enum ('pending', 'active', 'rejected');

create type action_type as enum (
  'panfletagem',
  'puxada_voto',
  'mutirao_cadastro',
  'comicio',
  'portas_portas',
  'outro'
);

create type action_status as enum ('draft', 'open', 'confirmed', 'completed', 'cancelled');

create type post_status as enum ('pending', 'published', 'removed', 'flagged');

-- 'exaggeration' não está no enum do contexto, mas a base inicial (6.2) tem um
-- item classificado como "Exagero" — que não é mentira nem meia verdade.
create type check_result as enum ('true', 'half_true', 'exaggeration', 'false', 'unverified');

create type consent_source as enum ('self', 'militant');
