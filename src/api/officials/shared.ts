import { readCache, withCache } from '@/lib/cache';

/**
 * Transparência: o que quem foi eleito está votando e propondo.
 *
 * Tudo vem das APIs de dados abertos da Câmara e do Senado, chamadas direto
 * do aparelho (as duas liberam CORS, menos o e-Cidadania no navegador). Não
 * passa pelo Supabase, então modo local e modo Supabase usam o mesmo caminho.
 *
 * Do ponto de vista editorial o app só repete campos da API (identificação,
 * ementa, data, situação, placar) e aponta o link oficial. Nada de resumo,
 * adjetivo ou "destaques", e a ordem é sempre por data.
 *
 * Pode ir para o cache de disco (src/lib/cache.ts) porque são atos públicos de
 * agente público no mandato, não dado pessoal de cidadão. Da pessoa só se
 * guarda nome parlamentar, partido e UF.
 */

export const CAMARA = 'https://dadosabertos.camara.leg.br/api/v2';
export const SENADO = 'https://legis.senado.leg.br/dadosabertos';
export const HOUR = 1000 * 60 * 60;
export const DAY = 24 * HOUR;

/**
 * Cache primeiro: dentro de `freshMs` nem vai à rede, porque cada abertura da
 * tela de votações custaria umas 45 requisições em 3G. Passado isso, vai à
 * rede e usa o cache de reserva se ela cair.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  freshMs: number,
  maxAgeMs: number,
): Promise<{ data: T | null; stale: boolean }> {
  const fresh = await readCache<T>(key, freshMs);
  if (fresh !== null) return { data: fresh, stale: false };
  return withCache(key, fetcher, maxAgeMs);
}

/**
 * Só o mandato atual: quem saiu do cargo não aparece, e o que aparece é do
 * mandato atual.
 *   Congresso (legislatura 57, eleitos em 2022)   2023-02-01 a 2027-01-31
 *   Presidente e governador (eleitos em 2022)     2023-01-01 a 2026-12-31
 *   Prefeito e vereador (eleitos em 2024)         2025-01-01 a 2028-12-31
 * Senador eleito em 2018 está na segunda metade do mandato (2019 a 2027), e
 * mostramos o que fez nesta legislatura, a mesma janela dos deputados.
 * Trocar essas datas quando os eleitos de 2026 tomarem posse.
 */
export const MANDATE = {
  congress: '2023-02-01',
  executive: '2023-01-01',
  municipal: '2025-01-01',
} as const;

/** Tipos que viram lei ou mudam a Constituição. Requerimento fica de fora, é ruído. */
export const BILL_TYPES = ['PL', 'PLP', 'PEC', 'PDL'];

export type House = 'camara' | 'senado';

export type Vote = {
  id: string;
  house: House;
  date: string; // YYYY-MM-DD
  /** "PLP 74/2026", quando a API informa a proposição. */
  label: string | null;
  /** Ementa da proposição ou, sem ela, a descrição da votação. Texto da API. */
  text: string;
  /** Descrição da votação (o que foi decidido), quando diferente do texto. */
  detail: string | null;
  /** Primeiro autor da proposição votada: "Nome (PARTIDO/UF)" ou o órgão. */
  author: string | null;
  /** Quantos outros assinam junto. */
  coauthors: number;
  url: string;
  /**
   * Voto de cada parlamentar. Senado: já vem na lista. Câmara: buscado ao
   * abrir a votação (listBallots). Votação simbólica não tem registro.
   */
  ballots?: Ballot[];
  /**
   * Decisões do mesmo dia sobre a mesma proposição (texto principal, emendas,
   * redação final...). A lista mostra uma linha por proposição; a tela da
   * votação mostra cada decisão.
   */
  steps?: VoteStep[];
};

export type VoteStep = { id: string; detail: string | null; ballots?: Ballot[] };

export type Ballot = { name: string; party: string; uf: string; vote: string };

export type Official = {
  id: string;
  house: House;
  name: string;
  party: string;
  uf: string;
  url: string;
};

export type Bill = {
  id: string;
  label: string;
  text: string;
  date: string;
  status: string | null;
  url: string;
  /** Situação resumida e data da situação ("Aprovado", "2017-07-26"). */
  outcome?: BillOutcome | null;
};

export type BillOutcome = { kind: 'approved' | 'rejected' | 'archived' | 'pending'; label: string; date: string | null };

/**
 * Traduz a situação oficial em 4 grupos. O texto oficial continua em
 * `status`; isto é só a etiqueta. Sem certeza, fica "Em tramitação".
 */
export function classifyStatus(raw: string | null | undefined, norma?: string | null): BillOutcome['kind'] {
  const t = (raw ?? '').toUpperCase();
  if (norma || /TRANSFORMAD[OA] EM NORMA|SANCIONAD|PROMULGAD|APROVAD[OA]$|^APROVAD[OA]/.test(t)) return 'approved';
  if (/REJEITAD|VETAD[OA] TOTAL/.test(t)) return 'rejected';
  if (/ARQUIVAD|PREJUDICAD|RETIRAD|TRAMITAÇÃO ENCERRADA|DEVOLVID/.test(t)) return 'archived';
  return 'pending';
}

export const OUTCOME_LABEL: Record<BillOutcome['kind'], string> = {
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  archived: 'Arquivado/encerrado',
  pending: 'Em tramitação',
};

export function outcomeOf(raw: string | null | undefined, date: string | null | undefined, norma?: string | null): BillOutcome {
  const kind = classifyStatus(raw, norma);
  return { kind, label: OUTCOME_LABEL[kind], date: date ? date.slice(0, 10) : null };
}

export type CamaraStatus = { dados: { statusProposicao: { dataHora: string | null; descricaoSituacao: string | null } } };

/** Situação atual de cada projeto da Câmara, uma consulta por projeto, em paralelo e com cache. */
export async function withCamaraOutcomes(bills: Bill[]): Promise<Bill[]> {
  const res = await Promise.allSettled(
    bills.map((b) => getJson<CamaraStatus>(`${CAMARA}/proposicoes/${b.id}`)),
  );
  return bills.map((b, i) => {
    const r = res[i];
    if (r?.status !== 'fulfilled') return b;
    const st = r.value.dados.statusProposicao;
    return { ...b, status: st.descricaoSituacao, outcome: outcomeOf(st.descricaoSituacao, st.dataHora) };
  });
}

export async function getJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Fonte oficial respondeu ${res.status}.`);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('A fonte oficial demorou para responder. Tente de novo.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** A API do Senado devolve objeto quando há um item só e array quando há vários. */
export function asList<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** URLs do Senado vêm em http://, que Android e PWA bloqueiam. */
export function https(url: string): string {
  return url.replace(/^http:\/\//, 'https://');
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
