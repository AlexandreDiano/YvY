import { supabase } from '@/lib/supabase';

/**
 * Imagens de post, no bucket privado `post-images` (criado no painel do Supabase).
 *
 * O banco guarda o caminho no bucket e não uma URL assinada. URL assinada
 * expira (a imagem sumiria do feed antigo) e, se alguém repassa, ela funciona
 * fora do app passando por cima da RLS. A assinatura é feita na leitura e dura pouco.
 *
 * Sem backend nada sai do aparelho e guardamos a própria URI local.
 */
const BUCKET = 'post-images';
const SIGN_TTL_S = 60 * 60; // 1h dá para ler o feed, não para sair circulando

export type PickedImage = { uri: string; base64?: string | null; mimeType?: string | null };

/**
 * Sobe os bytes da imagem. Não dá para usar `fetch(uri).blob()`: no React
 * Native esse blob chega vazio no Storage (o arquivo ficava com 14 bytes,
 * text/plain, e a imagem nunca aparecia). O seletor entrega base64 e a gente
 * converte para bytes aqui.
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

/**
 * Apaga as imagens da própria pasta (`<uid>/`) antes de apagar a conta: o
 * cascade do banco leva os posts, mas não mexe no Storage. Junta o que a
 * listagem acha (inclusive imagem que subiu e o post não saiu) com o caminho
 * guardado nos posts. Melhor esforço: falhar aqui não impede apagar a conta.
 */
export async function removeMyPostImages(userId: string): Promise<void> {
  if (!supabase) return;
  const paths = new Set<string>();
  try {
    const listed = await supabase.storage.from(BUCKET).list(userId, { limit: 1000 });
    for (const f of listed.data ?? []) paths.add(`${userId}/${f.name}`);
  } catch {
    // sem listagem: fica com o caminho dos posts
  }
  try {
    const posts = await supabase.from('posts').select('image_url').eq('author_id', userId);
    for (const p of posts.data ?? []) {
      if (p.image_url && !isLocal(p.image_url) && p.image_url.startsWith(`${userId}/`)) paths.add(p.image_url);
    }
  } catch {
    // idem
  }
  if (!paths.size) return;
  try {
    await supabase.storage.from(BUCKET).remove([...paths]);
  } catch {
    // arquivo que sobrar fica órfão no bucket privado, sem post que aponte para ele
  }
}
