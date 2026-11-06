/**
 * Busca e "ver mais" das listas grandes de Quem foi eleito (medidas
 * provisórias, proposições, senadores e deputados). Tudo local, sobre o que
 * já foi carregado da fonte oficial. Sem import de valor de `@/api`, para o
 * teste rodar em Node puro.
 */

/** Quantos itens a lista mostra de início e a cada "Ver mais". */
export const PAGE = 10;

/** Minúscula, sem acento e sem espaço nas pontas: "São Paulo" vira "sao paulo". */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Itens cujo texto contém todas as palavras da busca, em qualquer ordem.
 * Busca vazia devolve a lista inteira.
 */
export function filterBy<T>(items: readonly T[], query: string, toText: (item: T) => string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [...items];
  return items.filter((item) => {
    const text = fold(toText(item));
    return words.every((w) => text.includes(w));
  });
}

/**
 * O que aparece com `shown` itens à mostra e quantos ainda faltam.
 * O botão "Ver mais" só existe enquanto `remaining > 0`.
 */
export function page<T>(items: readonly T[], shown: number): { visible: T[]; remaining: number; next: number } {
  const n = Math.max(0, Math.min(shown, items.length));
  const remaining = items.length - n;
  return { visible: items.slice(0, n), remaining, next: Math.min(remaining, PAGE) };
}
