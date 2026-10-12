/**
 * Filtro de dado pessoal do relatório de erros, igual no APK e no site
 * (monitoring.ts / monitoring.web.ts).
 */
const PATTERNS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]'],
  [/\b\d{5}-?\d{3}\b/g, '[cep]'],
  [/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}\b/g, '[telefone]'],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[cpf]'],
];

export function scrub(text: string): string {
  return PATTERNS.reduce((t, [re, mark]) => t.replace(re, mark), text);
}

// Pilha de chamadas e metadados do SDK ficam como estão: o nome do arquivo
// JS tem hash com dígitos que o filtro confundiria com CEP/telefone, e o
// Sentry perderia o vínculo com o código-fonte. Pilha não tem dado de gente.
const KEEP = new Set(['stacktrace', 'debug_meta', 'sdk', 'release', 'dist', 'event_id', 'timestamp']);

export function scrubDeep<T>(value: T, depth = 0): T {
  if (depth > 8) return value;
  if (typeof value === 'string') return scrub(value) as T;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = KEEP.has(k) ? v : scrubDeep(v, depth + 1);
    return out as T;
  }
  return value;
}

/** URL sem query nem fragmento, e com ids trocados. */
export function safeUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  return scrub(url.split(/[?#]/)[0] ?? '');
}

