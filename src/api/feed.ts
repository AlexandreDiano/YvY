import type { PostFlag, PostListed, PostStatus, Profile } from '@/lib/db.types';
import { all, insert, localId, patch } from '@/lib/localStore';
import { supabase } from '@/lib/supabase';
import { withSignedImages } from '@/api/storage';

/** Feed local "Fala Camarada" (fluxo 4.4 / tela 7.4). */

export const MAX_POST_CHARS = 500;

export const FLAG_REASONS: { key: PostFlag['reason']; label: string }[] = [
  { key: 'spam', label: 'Spam' },
  { key: 'provocacao', label: 'Provocação' },
  { key: 'sem_fonte', label: 'Sem fonte' },
  { key: 'ofensa', label: 'Ofensa' },
  { key: 'outro', label: 'Outro' },
];

export type FeedScope = 'bairro' | 'estado' | 'regiao' | 'brasil';

/** Rótulo do nível, já com o lugar da pessoa ("Bairro · Quississana"). */
export function scopeLabel(scope: FeedScope, profile: Profile | null): string {
  switch (scope) {
    case 'bairro':
      return profile?.neighborhood ? `Bairro · ${profile.neighborhood}` : 'Bairro';
    case 'estado':
      return profile?.state ? `Estado · ${profile.state}` : 'Estado';
    case 'regiao':
      return `Região · ${regionOf(profile?.state)}`;
    case 'brasil':
      return 'Brasil';
  }
}

/** Mesma regra de `public.region_of` (migration 0021). */
export function regionOf(uf?: string | null): string {
  if (!uf) return '—';
  if (['PR', 'SC', 'RS'].includes(uf)) return 'Sul';
  if (['SP', 'RJ', 'MG', 'ES'].includes(uf)) return 'Sudeste';
  if (['DF', 'GO', 'MT', 'MS'].includes(uf)) return 'Centro-Oeste';
  if (['AM', 'PA', 'AC', 'RO', 'RR', 'AP', 'TO'].includes(uf)) return 'Norte';
  return 'Nordeste';
}

const REGION_UFS: Record<string, string[]> = {
  Sul: ['PR', 'SC', 'RS'],
  Sudeste: ['SP', 'RJ', 'MG', 'ES'],
  'Centro-Oeste': ['DF', 'GO', 'MT', 'MS'],
  Nordeste: ['BA', 'SE', 'AL', 'PE', 'PB', 'RN', 'CE', 'PI', 'MA'],
  Norte: ['AM', 'PA', 'AC', 'RO', 'RR', 'AP', 'TO'],
};

const COL_POSTS = 'posts';
const COL_FLAGS = 'flags';
const PAGE = 20;

/** Feed de um nível. A RLS já limita o que cada um vê; o filtro aqui escolhe a aba. */
export async function listFeed(profile: Profile, page = 0, scope: FeedScope = 'bairro'): Promise<PostListed[]> {
  if (!supabase) {
    const rows = await all<PostListed>(COL_POSTS);
    return rows
      .filter((p) => p.status === 'published' && (p.scope ?? 'bairro') === scope)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, (page + 1) * PAGE);
  }
  let q = supabase.from('posts_with_author').select('*').eq('status', 'published').eq('scope', scope);
  if (scope === 'bairro') q = q.eq('neighborhood', profile.neighborhood ?? '').eq('city', profile.city ?? '');
  if (scope === 'estado') q = q.eq('state', profile.state ?? '');
  if (scope === 'regiao') q = q.in('state', REGION_UFS[regionOf(profile.state)] ?? []);
  const res = await q.order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
  if (res.error) throw res.error;
  return withSignedImages(res.data as PostListed[]);
}

/** Autor apaga o próprio post (editar não existe). Admin também pode. */
export async function deletePost(postId: string): Promise<void> {
  if (!supabase) {
    await patch<PostListed>(COL_POSTS, postId, { status: 'removed' });
    return;
  }
  const res = await supabase.from('posts').delete().eq('id', postId);
  if (res.error) throw res.error;
}

export async function createPost(
  profile: Profile,
  content: string,
  imageUrl: string | null,
  scope: FeedScope = 'bairro',
): Promise<void> {
  const text = content.trim();
  if (!text) throw new Error('Escreva algo antes de publicar.');
  if (text.length > MAX_POST_CHARS) throw new Error(`Máximo de ${MAX_POST_CHARS} caracteres.`);

  if (!supabase) {
    await insert<PostListed>(COL_POSTS, {
      id: localId('post'),
      author_id: profile.id,
      content: text,
      image_url: imageUrl,
      neighborhood: profile.neighborhood ?? '',
      city: profile.city ?? '',
      state: profile.state ?? '',
      // Sem moderador no modo local, publica direto (em producao entra como 'pending').
      status: 'published',
      scope,
      moderator_id: null,
      moderator_note: null,
      flagged_count: 0,
      created_at: new Date().toISOString(),
      author_display_name: profile.display_name,
    });
    return;
  }
  const res = await supabase.from('posts').insert({
    author_id: profile.id,
    content: text,
    image_url: imageUrl,
    neighborhood: profile.neighborhood ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
    status: 'pending',
    scope,
  });
  if (res.error) throw res.error;
}

/** Fila de moderacao do bairro: pendentes + denunciados. */
export async function listForModeration(profile: Profile): Promise<PostListed[]> {
  if (!supabase) {
    const rows = await all<PostListed>(COL_POSTS);
    return rows.filter((p) => p.status === 'pending' || p.status === 'flagged');
  }
  // Bairro do moderador + (para admin) estado/região/Brasil. A RLS decide.
  const res = await supabase
    .from('posts_with_author')
    .select('*')
    .in('status', ['pending', 'flagged'])
    .or(
      `and(scope.eq.bairro,neighborhood.eq."${profile.neighborhood ?? ''}",city.eq."${profile.city ?? ''}"),scope.neq.bairro`,
    )
    .order('created_at');
  if (res.error) throw res.error;
  return withSignedImages(res.data as PostListed[]);
}

export async function moderate(
  postId: string,
  decision: Extract<PostStatus, 'published' | 'removed'>,
  moderatorId: string,
  note?: string,
): Promise<void> {
  if (!supabase) {
    await patch<PostListed>(COL_POSTS, postId, {
      status: decision,
      moderator_id: moderatorId,
      moderator_note: note ?? null,
    });
    return;
  }
  const res = await supabase
    .from('posts')
    .update({ status: decision, moderator_id: moderatorId, moderator_note: note ?? null })
    .eq('id', postId);
  if (res.error) throw res.error;
}

export async function flagPost(
  postId: string,
  flaggerId: string,
  reason: PostFlag['reason'],
  detail?: string,
): Promise<void> {
  if (!supabase) {
    const existing = (await all<PostFlag>(COL_FLAGS)).some(
      (f) => f.post_id === postId && f.flagger_id === flaggerId,
    );
    if (existing) throw new Error('Você já denunciou este post.');
    await insert<PostFlag>(COL_FLAGS, {
      id: localId('flag'),
      post_id: postId,
      flagger_id: flaggerId,
      reason,
      detail: detail ?? null,
      created_at: new Date().toISOString(),
    });
    const rows = await all<PostListed>(COL_POSTS);
    const post = rows.find((p) => p.id === postId);
    if (post) {
      const count = post.flagged_count + 1;
      await patch<PostListed>(COL_POSTS, postId, {
        flagged_count: count,
        status: count >= 3 ? 'flagged' : post.status,
      });
    }
    return;
  }
  const res = await supabase
    .from('post_flags')
    .insert({ post_id: postId, flagger_id: flaggerId, reason, detail: detail ?? null });
  if (res.error) {
    // 23505 = unique_violation: ja existe denuncia deste usuario neste post
    if (res.error.code === '23505') throw new Error('Você já denunciou este post.');
    throw res.error;
  }
}
