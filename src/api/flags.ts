import type { FeatureFlag } from '../lib/db.types';
import { withCache } from '../lib/cache';
import { supabase } from '../lib/supabase';

/**
 * Feature flags (secao 2.1 / risco "bug critico no dia 25"): permitem
 * desligar um modulo inteiro sem rebuild do app.
 */
export const FLAG = {
  acoes: 'module_acoes',
  feed: 'module_feed',
  puxada: 'module_puxada',
  checagem: 'module_checagem',
  convites: 'module_convites',
  transparencia: 'module_transparencia',
} as const;

export type FlagKey = (typeof FLAG)[keyof typeof FLAG];

/** Padrao local: o que fica ligado quando nao ha backend ou a rede caiu. */
export const DEFAULT_FLAGS: Record<FlagKey, boolean> = {
  module_acoes: true,
  module_feed: true,
  module_puxada: false, // ligado no dia 24/10 pelo painel admin
  module_checagem: true,
  module_convites: true,
  module_transparencia: true,
};

export async function loadFlags(): Promise<Record<string, boolean>> {
  if (!supabase) return { ...DEFAULT_FLAGS };
  const { data } = await withCache('flags', async () => {
    const res = await supabase!.from('feature_flags').select('key,is_enabled');
    if (res.error) throw res.error;
    return res.data as Pick<FeatureFlag, 'key' | 'is_enabled'>[];
  });
  const map: Record<string, boolean> = { ...DEFAULT_FLAGS };
  for (const row of data ?? []) map[row.key] = row.is_enabled;
  return map;
}
