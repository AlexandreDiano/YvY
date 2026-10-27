/**
 * Monitor de promessas (YVY-130): regras puras, sem React, para testar em Node.
 *
 * Promessa sem status registrado é "sem avaliação", não "não iniciada": a
 * equipe só afirma o andamento com prova (link oficial + data + nota).
 */
export const PROMISE_STATUSES = ['not_started', 'in_progress', 'fulfilled', 'partial', 'broken'] as const;
export type PromiseStatus = (typeof PROMISE_STATUSES)[number];

export const PROMISE_LABEL: Record<PromiseStatus, string> = {
  not_started: 'Não iniciada',
  in_progress: 'Em andamento',
  fulfilled: 'Cumprida',
  partial: 'Parcialmente cumprida',
  broken: 'Abandonada ou contrária',
};

export const UNRATED_LABEL = 'Sem avaliação';

export type PromiseFilter = PromiseStatus | 'unrated' | 'all';

export type PlanPromise = {
  sq_candidato: string;
  promise_key: string;
  position: number;
  tema: string;
  texto: string;
  pagina: number | null;
  status: PromiseStatus | null;
  source_url: string | null;
  evidence_date: string | null;
  note: string | null;
  updated_at: string | null;
};

export type PromiseUpdate = {
  id: string;
  sq_candidato: string;
  promise_key: string;
  status: PromiseStatus;
  source_url: string;
  evidence_date: string;
  note: string;
  created_at: string;
};

export const NOTE_MAX = 280;

/** Contagem por status, mais as sem avaliação. */
export function summarize(list: Pick<PlanPromise, 'status'>[]): Record<PromiseStatus | 'unrated', number> & {
  total: number;
} {
  const out = { not_started: 0, in_progress: 0, fulfilled: 0, partial: 0, broken: 0, unrated: 0, total: list.length };
  for (const p of list) out[p.status ?? 'unrated'] += 1;
  return out;
}

export function matchesFilter(p: Pick<PlanPromise, 'status'>, f: PromiseFilter): boolean {
  if (f === 'all') return true;
  if (f === 'unrated') return p.status === null;
  return p.status === f;
}

/** "27/10/2026" → "2026-10-27". Data inválida ou no futuro → null. */
export function parseBrDate(v: string, today = new Date()): string | null {
  const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return iso > todayIso ? null : iso;
}

/** Mesma regra da RPC: link http(s) com domínio. */
export function isSourceUrl(v: string): boolean {
  return /^https?:\/\/[^ ]+\.[^ ]+/i.test(v.trim());
}

/** O que falta para registrar a mudança; null = pode enviar. */
export function updateProblem(input: { url: string; date: string; note: string }, today = new Date()): string | null {
  if (!isSourceUrl(input.url)) return 'Cole o link da fonte oficial (começa com http).';
  if (!parseBrDate(input.date, today)) return 'Data da prova no formato DD/MM/AAAA, sem ser no futuro.';
  const note = input.note.trim();
  if (!note) return 'Escreva uma nota curta e neutra sobre a prova.';
  if (note.length > NOTE_MAX) return `Nota até ${NOTE_MAX} letras.`;
  return null;
}
