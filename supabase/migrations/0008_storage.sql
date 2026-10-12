-- Yvy — políticas do Storage (bucket de imagens do feed).
--
-- Criar o bucket antes, PRIVADO:
--   insert into storage.buckets (id, name, public) values ('post-images', 'post-images', false);
--
-- O banco guarda só o caminho (ver src/api/storage.ts). A leitura acontece por
-- URL assinada de 1h, e assinar exige permissão de select — daí a policy de
-- leitura. `list` não é concedido: o nome do arquivo só chega a quem já pode
-- ler o post correspondente.

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', false)
on conflict (id) do nothing;

-- Upload: só militante confirmado, e só dentro da própria pasta (uid/).
create policy post_images_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and public.is_militant_or_above()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Leitura (necessária para assinar a URL): militante confirmado ou admin.
create policy post_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'post-images'
    and (public.is_militant_or_above() or public.is_admin())
  );

-- Apagar: só o dono do arquivo e o admin.
create policy post_images_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-images'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
