import { onlyDigits } from '@/lib/format';

/**
 * Regras da tela Minha conta (app/conta.tsx), sem React nem Supabase, para dar
 * teste em Node puro (tests/unit/account.test.ts).
 */

/** Mesmo mínimo do cadastro (SignupForm) e do "Esqueci a senha". */
export const MIN_PASSWORD = 8;

/** Palavra que a pessoa digita para apagar a conta. A RPC confere de novo. */
export const DELETE_WORD = 'APAGAR';

/** Problema com a troca de senha, ou null se dá para mandar. */
export function passwordProblem(current: string, next: string, confirm: string): string | null {
  if (!current) return 'Digite a senha atual.';
  if (next.length < MIN_PASSWORD) return `A senha nova precisa de pelo menos ${MIN_PASSWORD} caracteres.`;
  if (next !== confirm) return 'As duas senhas não são iguais.';
  if (next === current) return 'A senha nova precisa ser diferente da atual.';
  return null;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Problema com o e-mail novo, ou null se dá para mandar. */
export function emailProblem(current: string | null | undefined, next: string): string | null {
  const addr = normalizeEmail(next);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return 'Digite um e-mail válido.';
  if (current && addr === normalizeEmail(current)) return 'Esse já é o e-mail da sua conta.';
  return null;
}

/** A pessoa digitou a palavra de confirmação (sem ligar para maiúscula e espaço). */
export function isDeleteConfirmed(typed: string): boolean {
  return typed.trim().toUpperCase() === DELETE_WORD;
}

/** CEP novo de verdade, com 8 dígitos e diferente do atual. */
export function cepChanged(current: string | null | undefined, next: string): boolean {
  const n = onlyDigits(next);
  return n.length === 8 && n !== onlyDigits(current ?? '');
}

type Area = { neighborhood: string | null; city: string | null; state: string | null };

/** Bairro, cidade ou UF mudou. É o que mexe em feed e moderação. */
export function areaChanged(before: Area, after: Area): boolean {
  const k = (a: Area) => [a.neighborhood, a.city, a.state].map((x) => (x ?? '').trim().toLowerCase()).join('|');
  return k(before) !== k(after);
}
