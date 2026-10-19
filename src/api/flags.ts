import type { FeatureFlag } from '@/lib/db.types';
import { withCache } from '@/lib/cache';
import { supabase } from '@/lib/supabase';

/**
 * Feature flags. Servem para desligar um módulo inteiro sem build novo, caso
 * algo quebre perto da eleição.
 */
export const FLAG = {
  acoes: 'module_acoes',
  feed: 'module_feed',
  checagem: 'module_checagem',
  convites: 'module_convites',
  transparencia: 'module_transparencia',
  chat: 'module_chat',
} as const;

export type FlagKey = (typeof FLAG)[keyof typeof FLAG];

/** O que fica ligado quando não tem backend ou a rede caiu. */
export const DEFAULT_FLAGS: Record<FlagKey, boolean> = {
  module_acoes: true,
  module_feed: true,
  module_checagem: true,
  module_convites: true,
  module_transparencia: true,
  // conversa só existe com servidor; na produção a flag decide
  module_chat: false,
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
