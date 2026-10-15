import { supabase } from '@/lib/supabase';

/**
 * Região geográfica imediata do IBGE de quem está logado (migration 0043):
 * a cidade da pessoa e as vizinhas que dependem dela. Curitiba, São José dos
 * Pinhais, Pinhais e Colombo, por exemplo, ficam na mesma.
 */
export type MyRegion = { id: number; name: string; uf: string; cities: string[] };

let cached: { uid: string; region: MyRegion | null } | null = null;

export async function myRegion(userId: string): Promise<MyRegion | null> {
  if (!supabase) return null;
  if (cached?.uid === userId) return cached.region;
  const res = await supabase.rpc('my_region' as never);
  if (res.error) return null;
  const row = (res.data as { regiao_id: number; regiao_nome: string; uf: string; cidades: string[] }[] | null)?.[0];
  const region = row ? { id: row.regiao_id, name: row.regiao_nome, uf: row.uf, cities: row.cidades ?? [] } : null;
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

/** Regiões que a pessoa segue para ler os posts de região de lá (migration 0045). */
export async function followedRegions(): Promise<MyRegion[]> {
  if (!supabase) return [];
  const res = await supabase.rpc('my_followed_regions' as never);
  if (res.error) return [];
  return (res.data as { regiao_id: number; regiao_nome: string; uf: string; cidades: string[] }[]).map((r) => ({
    id: r.regiao_id,
    name: r.regiao_nome,
    uf: r.uf,
    cities: r.cidades ?? [],
  }));
}

export type RegionOption = { id: number; name: string; uf: string; cityCount: number };

export async function listRegions(uf: string): Promise<RegionOption[]> {
  if (!supabase) return [];
  const res = await supabase.rpc('list_regions' as never, { p_uf: uf } as never);
  if (res.error) throw new Error(res.error.message);
  return (res.data as { regiao_id: number; regiao_nome: string; uf: string; cidades: number }[]).map((r) => ({
    id: r.regiao_id,
    name: r.regiao_nome,
    uf: r.uf,
    cityCount: r.cidades,
  }));
}

export async function followRegion(id: number, follow: boolean): Promise<void> {
  if (!supabase) return;
  const res = await supabase.rpc('follow_region' as never, { p_regiao: id, p_follow: follow } as never);
  if (res.error) throw new Error(res.error.message);
}

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];
