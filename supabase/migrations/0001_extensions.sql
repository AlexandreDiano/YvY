-- Yvy — extensões.
-- Rodar em ordem numérica. No Supabase: SQL Editor ou `supabase db push`.
--
-- Tudo no schema `extensions`, não em `public`: postgis em `public` cria
-- `spatial_ref_sys` exposta pela API sem RLS. Função DEFINER que usa algo
-- daqui precisa de `search_path = public, extensions`.

create extension if not exists pgcrypto with schema extensions;  -- gen_random_uuid()
create extension if not exists pg_trgm  with schema extensions;  -- similaridade de texto na checagem
create extension if not exists postgis  with schema extensions;  -- coordenadas das ações (raio de 2 km)
