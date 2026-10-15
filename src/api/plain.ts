import { supabase } from '@/lib/supabase';

/**
 * Versão simplificada de textos oficiais (ementas, descrições de votação e de
 * consulta). A IA escreve na Edge Function `simplify` e o resultado fica no
 * banco (migration 0019), então cada texto é simplificado uma vez para todo
 * mundo.
 *
 * Pedidos da mesma tela são juntados em lotes de 10 (uma chamada à IA por
 * lote) e o resultado fica em memória durante a sessão.
 */
const memo = new Map<string, string | null>();
const waiting = new Map<string, ((v: string | null) => void)[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const texts = [...waiting.keys()];
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += 10) batches.push(texts.slice(i, i + 10));
  await Promise.all(
    batches.map(async (batch) => {
      let results: (string | null)[] = batch.map(() => null);
      try {
        const { data } = await supabase!.functions.invoke('simplify', { body: { texts: batch } });
        const items = (data as { items?: { simple: string | null }[] })?.items ?? [];
        results = batch.map((_, i) => items[i]?.simple ?? null);
      } catch {
        // IA fora do ar, fica o texto original
      }
      batch.forEach((t, i) => {
        if (results[i]) memo.set(t, results[i]!);
        for (const resolve of waiting.get(t) ?? []) resolve(results[i] ?? null);
        waiting.delete(t);
      });
    }),
  );
}

/** Versão simplificada do texto, ou null se não deu. Junta pedidos próximos num lote. */
export function simplified(text: string): Promise<string | null> {
  const key = text.trim();
  if (!supabase || key.length < 12) return Promise.resolve(null);
  if (memo.has(key)) return Promise.resolve(memo.get(key) ?? null);
  return new Promise((resolve) => {
    waiting.set(key, [...(waiting.get(key) ?? []), resolve]);
    if (!timer) timer = setTimeout(() => void flush(), 60);
  });
}
