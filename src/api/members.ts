import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/lib/db.types';

/**
 * Papéis pelo app (migration 0032). Admin e quem tem a permissão de "mudar
 * papéis" alternam membro ↔ moderador; só admin dá ou tira essa permissão.
 * Tudo por RPC: `role` não tem UPDATE para o cliente.
 */
export type Member = {
  id: string;
  display_name: string;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  role: UserRole;
  is_role_manager: boolean;
};

export async function canManageRoles(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('can_manage_roles' as never);
  return !error && data === true;
}

export async function listMembers(query: string): Promise<Member[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('list_members' as never, { p_query: query.trim() || null } as never);
  if (error) throw error;
  return (data ?? []) as unknown as Member[];
}

export async function setMemberRole(userId: string, role: 'militant' | 'moderator'): Promise<void> {
  if (!supabase) throw new Error('Disponível só com o servidor configurado.');
  const { error } = await supabase.rpc('set_member_role' as never, { p_user: userId, p_role: role } as never);
  if (error) throw error;
}

export async function setRoleManager(userId: string, enabled: boolean): Promise<void> {
  if (!supabase) throw new Error('Disponível só com o servidor configurado.');
  const { error } = await supabase.rpc('set_role_manager' as never, { p_user: userId, p_enabled: enabled } as never);
  if (error) throw error;
}
