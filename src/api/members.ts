import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/lib/db.types';

/**
 * Papéis pelo app (migration 0032). Admin e quem tem a permissão de mudar
 * papéis alternam membro e moderador; só admin dá ou tira essa permissão. É
 * tudo por RPC porque `role` não tem UPDATE para o cliente.
 *
 * Convite (0036/0046): por padrão só moderador e admin convidam. Admin, quem
 * muda papéis, o moderador do bairro e quem convidou a pessoa liberam membro
 * por membro.
 */
export type Member = {
  id: string;
  display_name: string;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  role: UserRole;
  is_role_manager: boolean;
  /** Pode gerar convite: moderador/admin, ou membro liberado (0036). */
  can_invite: boolean;
  /** Quantas pessoas entraram pelo convite dele (0046). */
  invited_count: number;
  /** Apelido de quem convidou, se houver. */
  invited_by_name: string | null;
};

export type MemberInvitee = {
  id: string;
  display_name: string;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  membership_status: 'pending' | 'active' | 'rejected';
  created_at: string;
};

/** Quem este membro convidou. Para admin, quem muda papéis e moderador do bairro dele (0046). */
export async function inviteesOf(userId: string): Promise<MemberInvitee[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('invitees_of' as never, { p_user: userId } as never);
  if (error) throw error;
  return (data ?? []) as unknown as MemberInvitee[];
}

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

/** A pessoa logada pode gerar convite? No modo local todo membro pode, para testar. */
export async function canInvite(isBaseMember: boolean): Promise<boolean> {
  if (!supabase) return isBaseMember;
  const { data, error } = await supabase.rpc('can_invite' as never);
  return !error && data === true;
}

export async function setInvitePermission(userId: string, enabled: boolean): Promise<void> {
  if (!supabase) throw new Error('Disponível só com o servidor configurado.');
  const { error } = await supabase.rpc('set_invite_permission' as never, { p_user: userId, p_enabled: enabled } as never);
  if (error) throw error;
}

/** Consentimento para dado de participação política, para quem entrou antes da 0039. */
export async function giveSensitiveConsent(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('give_sensitive_consent' as never);
  if (error) throw error;
}

/**
 * Suspende (ou, só admin, reativa) uma conta. Admin suspende qualquer um que
 * não seja admin; moderador, membro comum do bairro que modera. A pessoa
 * recebe aviso com o motivo (migration 0044).
 */
export async function setMemberActive(userId: string, active: boolean, reason?: string): Promise<void> {
  if (!supabase) return;
  const res = await supabase.rpc(
    'set_member_active' as never,
    { p_user: userId, p_active: active, p_reason: reason ?? null } as never,
  );
  if (res.error) throw new Error(res.error.message);
}
