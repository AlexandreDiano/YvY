// Casamento de pauta com palavra-chave (DIANO-136). Puro, sem Deno: a Edge
// Function usa e tests/unit/voteMatch.test.ts testa no Node.
//
// O app só repete o que a fonte oficial publica (sigla, número, ementa, data).
// Quem escolhe os temas é a lista de palavras-chave da equipe
// (vote_alert_keywords); o código só diz se a ementa contém o termo.

/** Tipos que vão a voto e mudam lei ou orçamento. Requerimento de sessão
 * especial, moção e afins não avisam. */
export const SIGLAS = new Set(['PL', 'PLP', 'PEC', 'MPV', 'PLV', 'PDL', 'PLN', 'PLS', 'PRC']);

export type Item = {
  casa: 'camara' | 'senado' | 'congresso';
  /** id da proposição na casa (chave de "já avisei") */
  propId: string;
  sigla: string;
  numero: string;
  ano: string;
  ementa: string;
  /** requerimento de urgência para esta proposição */
  urgencia: boolean;
  sessionAt: string;
  /** ficha oficial da proposição */
  url: string;
  /** consulta pública onde o cidadão vota: e-Cidadania (Senado) ou enquete
   * (Câmara). Sessão do Congresso Nacional não tem. */
  voteUrl: string | null;
};

/** minúscula, sem acento, espaço simples */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function has(text: string, term: string): boolean {
  const prefix = term.endsWith('*');
  const t = norm(prefix ? term.slice(0, -1) : term);
  if (!t) return false;
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}${prefix ? '' : '($|[^a-z0-9])'}`).test(text);
}

/**
 * Termos da lista que aparecem na ementa, sem diferenciar acento nem
 * maiúscula. Termo vale como palavra inteira ("sus" não pega "suspensão");
 * com * no fim vale como começo de palavra ("aposentad*" pega aposentadoria e
 * aposentados). Termo com - na frente exclui: se aparecer, nada avisa
 * ("-vara do trabalho").
 */
export function matchTerms(ementa: string, terms: string[]): string[] {
  const text = norm(ementa);
  const hits: string[] = [];
  for (const raw of terms) {
    const term = raw.trim();
    if (term.startsWith('-')) {
      if (has(text, term.slice(1).trim())) return [];
    } else if (has(text, term)) {
      hits.push(term);
    }
  }
  return hits;
}

export function alertable(item: Pick<Item, 'sigla'>): boolean {
  return SIGLAS.has(item.sigla.toUpperCase());
}

const CASA = { camara: 'na Câmara', senado: 'no Senado', congresso: 'no Congresso' } as const;

/**
 * Título do aviso: identificação oficial e, quando há consulta pública, o
 * convite para votar nela antes da sessão.
 */
export function title(item: Item): string {
  const id = `${item.sigla} ${Number(item.numero) || item.numero}/${item.ano}`;
  const what = item.urgencia ? `urgência do ${id}` : id;
  if (item.voteUrl) return `Vote na consulta pública: ${what} vai a votação ${CASA[item.casa]}`;
  return item.urgencia ? `Urgência em pauta ${CASA[item.casa]}: ${id}` : `Em pauta ${CASA[item.casa]}: ${id}`;
}
