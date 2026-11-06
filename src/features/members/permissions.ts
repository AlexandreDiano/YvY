import type { Member } from '@/api/members';

/**
 * Regras da tela Membros (YVY-62): filtro da lista e quem cada ação em massa
 * alcança. Ação em massa chama a mesma RPC de um por um, que confere tudo de
 * novo no banco. Aqui só sai da lista quem já está no estado pedido, para não
 * mandar aviso (e e-mail, que gasta a cota do Resend) à toa.
 */
export type MemberFilter = 'all' | 'invite' | 'no_invite' | 'inviters' | 'moderators';

export const FILTERS: { key: MemberFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'invite', label: 'Podem convidar' },
  { key: 'no_invite', label: 'Não podem' },
  { key: 'inviters', label: 'Convidaram alguém' },
  { key: 'moderators', label: 'Moderadores' },
];

export function matchesFilter(m: Member, f: MemberFilter): boolean {
  switch (f) {
    case 'invite':
      return m.can_invite;
    case 'no_invite':
      return !m.can_invite;
    case 'inviters':
      return m.invited_count > 0;
    case 'moderators':
      return m.role === 'moderator';
    default:
      return true;
  }
}

/** Admin e a própria pessoa não mudam pela tela. */
export function isEditable(m: Member, selfId: string | undefined): boolean {
  return m.id !== selfId && m.role !== 'admin';
}

export type BulkAction = 'invite_on' | 'invite_off' | 'make_mod' | 'remove_mod';

export const BULK_LABEL: Record<BulkAction, string> = {
  invite_on: 'Liberar convite',
  invite_off: 'Tirar convite',
  make_mod: 'Tornar moderador',
  remove_mod: 'Tirar moderação',
};

/** Quem a ação alcança. Moderador e admin convidam pelo papel, então convite é só para membro comum. */
export function bulkTargets(members: Member[], action: BulkAction, rolesPower: boolean): Member[] {
  return members.filter((m) => {
    if (m.role === 'admin') return false;
    switch (action) {
      case 'invite_on':
        return m.role === 'militant' && !m.can_invite;
      case 'invite_off':
        return m.role === 'militant' && m.can_invite;
      case 'make_mod':
        return rolesPower && m.role === 'militant';
      case 'remove_mod':
        return rolesPower && m.role === 'moderator';
    }
  });
}

export type BulkResult = { ok: Member[]; failed: { member: Member; message: string }[] };

/** Um de cada vez: a RPC manda aviso por pessoa e o moderador pode ter selecionado alguém fora do bairro dele. */
export async function runBulk(targets: Member[], call: (m: Member) => Promise<void>): Promise<BulkResult> {
  const result: BulkResult = { ok: [], failed: [] };
  for (const m of targets) {
    try {
      await call(m);
      result.ok.push(m);
    } catch (err) {
      result.failed.push({ member: m, message: err instanceof Error ? err.message : 'erro' });
    }
  }
  return result;
}

/** "A, B, C e mais 4" para a confirmação. */
export function namesPreview(names: string[], max = 6): string {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} e mais ${names.length - max}`;
}
