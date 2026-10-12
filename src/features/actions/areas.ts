import { readCache, writeCache } from '@/lib/cache';
import { supabase } from '@/lib/supabase';

/**
 * Bairros com membros, para colorir o mapa das ações (RPC members_by_area,
 * 0033). Só contagem — o banco já esconde bairro com 1 ou 2 pessoas de quem
 * não é da equipe.
 */
export type AreaCount = { neighborhood: string; city: string; state: string | null; members: number; mine: boolean };

export async function membersByArea(): Promise<AreaCount[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('members_by_area' as never);
  if (error) return [];
  return (data ?? []) as unknown as AreaCount[];
}

/** Contorno do bairro (GeoJSON) ou, se o OSM não tiver, só o ponto central. */
export type AreaShape = { lat: number; lng: number; geo: unknown | null };

// Só aceita resultado que seja bairro de fato: se o OSM não acha o bairro e
// devolve a cidade, pintar a cidade inteira mentiria no mapa.
const AREA_TYPES = new Set(['suburb', 'neighbourhood', 'quarter', 'city_district', 'borough', 'residential', 'hamlet', 'village']);
const NOMINATIM =
  'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&polygon_geojson=1&polygon_threshold=0.0003&q=';
const MONTH = 1000 * 60 * 60 * 24 * 30;

let lastCall = 0;

/**
 * Busca no OpenStreetMap (Nominatim) com cache de 30 dias no aparelho —
 * geografia pública, não é dado de ninguém. Respeita 1 pedido por segundo,
 * regra de uso do Nominatim.
 */
export async function areaShape(a: AreaCount, signal: AbortSignal): Promise<AreaShape | null> {
  const key = `area:v1:${a.neighborhood}|${a.city}|${a.state ?? ''}`.toLowerCase();
  const cached = await readCache<AreaShape | 'none'>(key, MONTH);
  if (cached) return cached === 'none' ? null : cached;

  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  if (signal.aborted) return null;
  lastCall = Date.now();
  try {
    const q = encodeURIComponent(`${a.neighborhood}, ${a.city}, ${a.state ?? ''}`);
    const r = await fetch(NOMINATIM + q, {
      headers: { 'User-Agent': 'Yvy/1.0 (app de organizacao de base)' },
      signal,
    });
    const j = (await r.json()) as { lat: string; lon: string; addresstype?: string; geojson?: { type: string } }[];
    const hit = j[0];
    if (!hit || !AREA_TYPES.has(hit.addresstype ?? '')) {
      await writeCache(key, 'none');
      return null;
    }
    const poly = hit.geojson && (hit.geojson.type === 'Polygon' || hit.geojson.type === 'MultiPolygon');
    const shape: AreaShape = { lat: Number(hit.lat), lng: Number(hit.lon), geo: poly ? hit.geojson : null };
    await writeCache(key, shape);
    return shape;
  } catch {
    return null; // rede caiu: tenta de novo na próxima vez, sem gravar "none"
  }
}
