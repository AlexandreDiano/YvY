import { supabase } from '@/lib/supabase';

/**
 * Imagens de post. Bucket PRIVADO `post-images` (criar no painel do Supabase).
 *
 * O banco guarda o CAMINHO no bucket, nunca uma URL assinada: URL assinada
 * expira (a imagem sumiria do feed antigo) e, se alguém a repassa, ela vale
 * fora do app, por cima do RLS. A assinatura é feita na leitura, curta.
 *
 * Sem backend nada sai do aparelho: guardamos a própria URI local.
 */
const BUCKET = 'post-images';
const SIGN_TTL_S = 60 * 60; // 1h: tempo de ler o feed, não de circular por aí

export type PickedImage = { uri: string; base64?: string | null; mimeType?: string | null };

/**
 * Sobe os BYTES da imagem. Não usar `fetch(uri).blob()`: no React Native esse
 * blob vai vazio para o Storage (o arquivo chegava com 14 bytes, text/plain, e
 * a imagem nunca aparecia). O seletor entrega base64; viramos bytes aqui.
 */
export async function uploadPostImage(image: PickedImage, userId: string): Promise<string> {
  if (!supabase) return image.uri;
  if (!image.base64) throw new Error('Não foi possível ler a imagem. Tente escolher de novo.');

  const contentType = image.mimeType || 'image/jpeg';
  const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const bytes = Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0));

  const up = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (up.error) throw up.error;
  return path;
}

/** Já é URI local ou http? Então não é caminho de bucket. */
function isLocal(value: string): boolean {
  return /^(file|content|data|https?|blob):/.test(value);
}

/**
 * Troca caminhos de bucket por URLs assinadas, em lote. Linha cuja assinatura
 * falha fica sem imagem em vez de derrubar o feed.
 */
export async function withSignedImages<T extends { image_url: string | null }>(
  rows: T[],
): Promise<T[]> {
  if (!supabase) return rows;

  const paths = [...new Set(rows.map((r) => r.image_url).filter((u): u is string => !!u && !isLocal(u)))];
  if (!paths.length) return rows;

  const signed = new Map<string, string>();
  const res = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGN_TTL_S);
  if (!res.error) {
    for (const item of res.data ?? []) {
      if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
    }
  }

  return rows.map((r) =>
    r.image_url && signed.has(r.image_url) ? { ...r, image_url: signed.get(r.image_url)! } : r,
  );
}
