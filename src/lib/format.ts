import { env } from '@/lib/env';

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Dias cheios até a votação. Nunca negativo. */
export function daysToElection(now = new Date()): number {
  const diff = env.electionDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export function electionLabel(): string {
  const d = env.electionDate;
  return `${DIAS_CURTO[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "Sáb 18/10, 9h", o formato dos wireframes. */
export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getMinutes() === 0 ? `${d.getHours()}h` : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${DIAS_CURTO[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}, ${h}`;
}

/** "2026-09-03" vira "03/09/2026" sem passar por Date, que pode virar o dia por causa do fuso. */
export function brDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function longDate(iso: string): string {
  const d = new Date(iso);
  return `${DIAS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "2h", "ontem, 18:32", "12/10". Usado no feed. */
export function relativeTime(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24 && then.getDate() === now.getDate()) return `${hours}h`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (then.getDate() === yesterday.getDate() && then.getMonth() === yesterday.getMonth()) {
    return `ontem, ${pad(then.getHours())}:${pad(then.getMinutes())}`;
  }
  return `${pad(then.getDate())}/${pad(then.getMonth() + 1)}`;
}

/** Separador do feed: "Hoje", "Ontem" ou a data. */
export function dayBucket(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (same(d, now)) return 'Hoje';
  if (same(d, yesterday)) return 'Ontem';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/**
 * "José da Silva Santos" vira "J.S.". O apelido sugerido nunca carrega o nome
 * completo.
 */
export function suggestDisplayName(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-ZÁ-Ú]/.test(p));
  if (!parts.length) return '';
  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : '';
  return last ? `${first}.${last}.`.toUpperCase() : `${first}.`.toUpperCase();
}

/** Como o app exibe qualquer pessoa: "Camarada J.S.". */
/**
 * Nome de exibição com "Camarada" uma vez só. O apelido salvo pode já vir com
 * o prefixo ("Camarada A.D.").
 */
export function camarada(displayName?: string | null): string {
  const n = (displayName ?? '').trim();
  if (!n) return 'Camarada';
  return /^camarada\b/i.test(n) ? n : `Camarada ${n}`;
}

export function onlyDigits(v: string): string {
  return v.replace(/\D+/g, '');
}

export function formatCep(v: string): string {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function formatPhone(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
