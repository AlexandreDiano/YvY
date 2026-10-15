import { supabase } from '@/lib/supabase';

/**
 * Região geográfica imediata do IBGE de quem está logado (migration 0043):
 * a cidade da pessoa e as vizinhas que dependem dela. Curitiba, São José dos
 * Pinhais, Pinhais e Colombo, por exemplo, ficam na mesma.
 */
export type MyRegion = { id: number; name: string; cities: string[] };

let cached: { uid: string; region: MyRegion | null } | null = null;

export async function myRegion(userId: string): Promise<MyRegion | null> {
  if (!supabase) return null;
  if (cached?.uid === userId) return cached.region;
  const res = await supabase.rpc('my_region' as never);
  if (res.error) return null;
  const row = (res.data as { regiao_id: number; regiao_nome: string; cidades: string[] }[] | null)?.[0];
  const region = row ? { id: row.regiao_id, name: row.regiao_nome, cities: row.cidades ?? [] } : null;
  cached = { uid: userId, region };
  return region;
}

/** Mesma normalização de `public.norm_city`: sem acento, apóstrofo nem hífen. */
export function normCity(t: string | null | undefined): string {
  return (t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`´-]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function inRegion(city: string | null | undefined, region: MyRegion): boolean {
  const c = normCity(city);
  return region.cities.some((x) => normCity(x) === c);
}
