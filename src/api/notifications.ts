import type { AppNotification } from '../lib/db.types';
import { supabase } from '../lib/supabase';

/**
 * Avisos dentro do app (tabela `notifications`, migration 0021): post
 * publicado ou recusado, com o motivo da moderação. Quem grava é trigger do
 * banco; o app só lê e marca como lido.
 */
export async function listNotifications(): Promise<AppNotification[]> {
  if (!supabase) return [];
  const res = await supabase
    .from('notifications' as never)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (res.error) return [];
  return res.data as unknown as AppNotification[];
}

export async function unreadCount(): Promise<number> {
  if (!supabase) return 0;
  const res = await supabase
    .from('notifications' as never)
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  return res.count ?? 0;
}

export async function markAllRead(): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('notifications' as never)
    .update({ read_at: new Date().toISOString() } as never)
    .is('read_at', null);
}

/** Apaga um aviso (ou todos, sem id). Só os da própria pessoa (RLS, 0028). */
export async function deleteNotifications(id?: string): Promise<void> {
  if (!supabase) return;
  const q = supabase.from('notifications' as never).delete();
  const res = id ? await q.eq('id', id) : await q.not('id', 'is', null);
  if (res.error) throw res.error;
}
