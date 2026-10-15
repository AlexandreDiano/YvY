import type { ActionListed, ActionParticipant, ActionStatus, ActionType, Profile } from '@/lib/db.types';
import { all, insert, localId, patch } from '@/lib/localStore';
import { supabase } from '@/lib/supabase';

/** Ações de mobilização. */

export const ACTION_TYPES: { key: ActionType; label: string }[] = [
  { key: 'panfletagem', label: 'Panfletagem' },
  { key: 'mutirao_cadastro', label: 'Mutirão de cadastro' },
  { key: 'comicio', label: 'Comício' },
  { key: 'portas_portas', label: 'Porta a porta' },
  { key: 'outro', label: 'Outro' },
];

export function actionTypeLabel(t: ActionType): string {
  return ACTION_TYPES.find((x) => x.key === t)?.label ?? t;
}

export type NewAction = {
  title: string;
  description: string;
  type: ActionType;
  scheduled_at: string;
  location_name: string;
  /** Ponto de encontro marcado no mapa (opcional). */
  lat?: number | null;
  lng?: number | null;
  max_participants: number | null;
  visibility: 'base' | 'public';
};

const COL_ACTIONS = 'actions';
const COL_PARTS = 'participants';

export async function listActions(profile: Profile): Promise<ActionListed[]> {
  if (!supabase) {
    const rows = await all<ActionListed>(COL_ACTIONS);
    return rows
      .filter((a) => a.status !== 'draft' && a.status !== 'cancelled')
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }
  const res = await supabase
    .from('actions_with_counts')
    .select('*')
    .in('status', ['open', 'confirmed'])
    .eq('neighborhood', profile.neighborhood ?? '')
    .eq('city', profile.city ?? '')
    .order('scheduled_at');
  if (res.error) throw res.error;
  return res.data as ActionListed[];
}

export async function getAction(id: string): Promise<ActionListed | null> {
  if (!supabase) {
    const rows = await all<ActionListed>(COL_ACTIONS);
    return rows.find((a) => a.id === id) ?? null;
  }
  const res = await supabase.from('actions_with_counts').select('*').eq('id', id).maybeSingle();
  if (res.error) throw res.error;
  return (res.data as ActionListed | null) ?? null;
}

export async function createAction(profile: Profile, input: NewAction): Promise<string> {
  if (!supabase) {
    const row: ActionListed = {
      id: localId('action'),
      title: input.title,
      description: input.description || null,
      type: input.type,
      status: 'open',
      scheduled_at: input.scheduled_at,
      location_name: input.location_name || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      neighborhood: profile.neighborhood,
      city: profile.city,
      state: profile.state,
      max_participants: input.max_participants,
      created_by: profile.id,
      visibility: input.visibility,
      cancel_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      participant_count: 0,
      creator_display_name: profile.display_name,
    };
    await insert(COL_ACTIONS, row);
    return row.id;
  }
  const res = await supabase
    .from('actions')
    .insert({
      title: input.title,
      description: input.description || null,
      type: input.type,
      status: 'open',
      scheduled_at: input.scheduled_at,
      location_name: input.location_name || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      neighborhood: profile.neighborhood,
      city: profile.city,
      state: profile.state,
      max_participants: input.max_participants,
      created_by: profile.id,
      visibility: input.visibility,
    })
    .select('id')
    .single();
  if (res.error) throw res.error;
  return (res.data as { id: string }).id;
}

export async function setStatus(id: string, status: ActionStatus, reason?: string): Promise<void> {
  if (!supabase) {
    await patch<ActionListed>(COL_ACTIONS, id, { status, cancel_reason: reason ?? null });
    return;
  }
  const res = await supabase
    .from('actions')
    .update({ status, cancel_reason: reason ?? null })
    .eq('id', id);
  if (res.error) throw res.error;
}

export async function myConfirmations(userId: string): Promise<Set<string>> {
  if (!supabase) {
    const rows = await all<ActionParticipant>(COL_PARTS);
    return new Set(rows.filter((p) => p.user_id === userId && p.status === 'confirmed').map((p) => p.action_id));
  }
  const res = await supabase
    .from('action_participants')
    .select('action_id,status')
    .eq('user_id', userId)
    .eq('status', 'confirmed');
  if (res.error) throw res.error;
  return new Set((res.data as { action_id: string }[]).map((r) => r.action_id));
}

export async function confirmPresence(actionId: string, userId: string): Promise<void> {
  if (!supabase) {
    const rows = await all<ActionParticipant>(COL_PARTS);
    const existing = rows.find((p) => p.action_id === actionId && p.user_id === userId);
    if (existing) {
      await patch<ActionParticipant>(COL_PARTS, existing.id, { status: 'confirmed' });
    } else {
      await insert<ActionParticipant>(COL_PARTS, {
        id: localId('part'),
        action_id: actionId,
        user_id: userId,
        status: 'confirmed',
        checked_in_at: null,
        created_at: new Date().toISOString(),
      });
    }
    await bumpLocalCount(actionId, +1);
    return;
  }
  const res = await supabase
    .from('action_participants')
    .upsert({ action_id: actionId, user_id: userId, status: 'confirmed' }, { onConflict: 'action_id,user_id' });
  if (res.error) throw res.error;
}

export async function cancelPresence(actionId: string, userId: string): Promise<void> {
  if (!supabase) {
    const rows = await all<ActionParticipant>(COL_PARTS);
    const existing = rows.find((p) => p.action_id === actionId && p.user_id === userId);
    if (existing) await patch<ActionParticipant>(COL_PARTS, existing.id, { status: 'cancelled' });
    await bumpLocalCount(actionId, -1);
    return;
  }
  const res = await supabase
    .from('action_participants')
    .update({ status: 'cancelled' })
    .eq('action_id', actionId)
    .eq('user_id', userId);
  if (res.error) throw res.error;
}

/** "Estou aqui" no dia da ação. */
export async function checkIn(actionId: string, userId: string): Promise<void> {
  const at = new Date().toISOString();
  if (!supabase) {
    const rows = await all<ActionParticipant>(COL_PARTS);
    const existing = rows.find((p) => p.action_id === actionId && p.user_id === userId);
    if (existing) await patch<ActionParticipant>(COL_PARTS, existing.id, { checked_in_at: at });
    return;
  }
  const res = await supabase
    .from('action_participants')
    .update({ checked_in_at: at })
    .eq('action_id', actionId)
    .eq('user_id', userId);
  if (res.error) throw res.error;
}

async function bumpLocalCount(actionId: string, delta: number): Promise<void> {
  const rows = await all<ActionListed>(COL_ACTIONS);
  const row = rows.find((a) => a.id === actionId);
  if (!row) return;
  await patch<ActionListed>(COL_ACTIONS, actionId, {
    participant_count: Math.max(0, row.participant_count + delta),
  });
}
