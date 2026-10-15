import { SEED_CARDS } from '@/data/cards';
import { SEED_CHECKS } from '@/data/factChecks';
import { withCache } from '@/lib/cache';
import type { CheckResult, FactCheck, ProposalCard } from '@/lib/db.types';
import { supabase } from '@/lib/supabase';
import { requestClaimCheck } from '@/api/claims';

/**
 * Conteúdo público: cards de proposta e checagem de fatos.
 *
 * Sempre tem resposta. Sem backend ou sem rede usa o seed embutido no bundle,
 * que é idêntico ao de supabase/seed e não muda sozinho, então servir a cópia
 * local está certo e não é gambiarra.
 */

const localCards: ProposalCard[] = SEED_CARDS.map((c, i) => ({
  ...c,
  id: `local-card-${i + 1}`,
  is_active: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
}));

const localChecks: FactCheck[] = SEED_CHECKS.map((c, i) => ({
  ...c,
  id: `local-check-${i + 1}`,
  is_active: true,
  created_at: new Date(0).toISOString(),
}));

/**
 * Card só vai ao ar com link para a fonte (revisão jurídica de 12/10). "O que
 * ele disse" sem link é a parte mais fácil de contestar (direito de resposta,
 * Lei 9.504 art. 58). Card sem `source_url` continua no banco, só não aparece
 * até a equipe editorial colocar o link.
 */
const publishable = (c: ProposalCard) => Boolean(c.source_url?.trim());

export async function listCards(): Promise<{ cards: ProposalCard[]; stale: boolean }> {
  const r = await listAllCards();
  return { ...r, cards: r.cards.filter(publishable) };
}

async function listAllCards(): Promise<{ cards: ProposalCard[]; stale: boolean }> {
  if (!supabase) return { cards: localCards, stale: false };
  try {
    const { data, stale } = await withCache('cards', async () => {
      const res = await supabase!
        .from('proposal_cards')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (res.error) throw res.error;
      return res.data as ProposalCard[];
    });
    return { cards: data?.length ? data : localCards, stale };
  } catch {
    return { cards: localCards, stale: true };
  }
}

export async function getCard(id: string): Promise<ProposalCard | null> {
  const { cards } = await listCards();
  return cards.find((c) => c.id === id) ?? null;
}

export async function listChecks(): Promise<FactCheck[]> {
  if (!supabase) return localChecks;
  try {
    const { data } = await withCache('checks', async () => {
      const res = await supabase!
        .from('fact_checks')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (res.error) throw res.error;
      return res.data as FactCheck[];
    });
    return data?.length ? data : localChecks;
  } catch {
    return localChecks;
  }
}

export type CheckOutcome = {
  /**
   * editorial: base revisada pela equipe. auto: checagem da IA já guardada.
   * queued: acabou de entrar na fila. none: sem resposta.
   */
  kind: 'editorial' | 'auto' | 'queued' | 'none';
  result: CheckResult;
  claim: string;
  explanation: string;
  source_name: string | null;
  source_url: string | null;
  checked_at: string | null;
};

const NOT_FOUND = (claim: string): CheckOutcome => ({
  kind: 'none',
  checked_at: null,
  result: 'unverified',
  claim,
  explanation:
    'Não verificamos este fato ainda. Você pode reportar para a equipe de checagem — e, até lá, não compartilhe.',
  source_name: null,
  source_url: null,
});

/**
 * Checa um texto colado.
 *
 * Com backend usa a RPC `search_fact_checks` (pg_trgm, limiar 0.7). Sem
 * backend compara sobreposição de palavras com o seed local, que é bem mais
 * fraco que trigram mas dá conta dos poucos itens iniciais.
 */
export async function checkFact(input: string): Promise<CheckOutcome> {
  const claim = input.trim();
  if (claim.length < 8) throw new Error('Escreva ou cole um trecho maior para checar.');

  if (supabase) {
    let editorialMiss = false;
    try {
      const res = await supabase.rpc('search_fact_checks', { q: claim, min_score: 0.7 });
      if (!res.error && Array.isArray(res.data) && res.data.length) {
        const hit = res.data[0] as FactCheck;
        return {
          kind: 'editorial',
          checked_at: null,
          result: hit.result,
          claim: hit.claim_text,
          explanation: hit.explanation,
          source_name: hit.source_name,
          source_url: hit.source_url,
        };
      }
      if (!res.error) editorialMiss = true;
    } catch {
      // rede caiu, cai no seed local lá embaixo
    }
    // Fora do try porque erro da fila ("fila cheia hoje") tem que chegar na
    // tela, não pode virar o "não verificamos" do seed local.
    if (editorialMiss) return fromQueue(claim);
  }

  const pool = supabase ? await listChecks() : localChecks;
  const hit = bestLocalMatch(claim, pool);
  return hit
    ? {
        kind: 'editorial',
        checked_at: null,
        result: hit.result,
        claim: hit.claim_text,
        explanation: hit.explanation,
        source_name: hit.source_name,
        source_url: hit.source_url,
      }
    : NOT_FOUND(claim);
}

/**
 * A base editorial não cobre, então pede para a fila de checagem automática.
 * Se o mesmo texto já foi checado nos últimos 7 dias a resposta vem na hora.
 */
async function fromQueue(claim: string): Promise<CheckOutcome> {
  const c = await requestClaimCheck(claim);
  if (!c) return NOT_FOUND(claim);
  if (c.status === 'done' && c.result) {
    return {
      // já conferida e publicada pela equipe: vale como checagem da base
      kind: c.reviewed ? 'editorial' : 'auto',
      result: c.result,
      claim: c.claim_text ?? claim,
      explanation: c.explanation ?? '',
      source_name: c.source_name,
      source_url: c.source_url,
      checked_at: c.checked_at,
    };
  }
  return {
    kind: 'queued',
    result: 'unverified',
    claim,
    explanation:
      'Entrou na fila de checagem. O resultado aparece aqui e no Início assim que ficar pronto — em geral em menos de 1 hora. Até lá, não compartilhe.',
    source_name: null,
    source_url: null,
    checked_at: null,
  };
}

const STOP = new Set([
  'a','o','as','os','de','da','do','das','dos','e','em','no','na','nos','nas','um','uma',
  'para','por','com','que','vai','ser','sera','e','ao','aos','sobre','mais','so','pelo','pela',
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function bestLocalMatch(claim: string, pool: FactCheck[]): FactCheck | null {
  const q = new Set(tokens(claim));
  if (!q.size) return null;
  let best: { row: FactCheck; score: number } | null = null;
  for (const row of pool) {
    const t = tokens(row.claim_text);
    if (!t.length) continue;
    const hits = t.filter((w) => q.has(w)).length;
    const score = hits / t.length; // fracao das palavras do claim conhecido presentes
    if (!best || score > best.score) best = { row, score };
  }
  return best && best.score >= 0.5 ? best.row : null;
}
