import type { Invite, Profile } from '../lib/db.types';
import { all, insert, localId } from '../lib/localStore';
import { supabase } from '../lib/supabase';

/**
 * Convites por QRCode presencial (fluxo 4.2).
 *
 * Regras de ouro implementadas aqui e na RPC `redeem_invite`:
 *  - convite pessoal: 1 uso, 24h. QRCode de mesa: 20 usos, 4h.
 *  - convite à distância: código de texto, 1 uso, 24h, só moderador/admin
 *    gera (policy em 0015_invites_remote.sql). Membro comum não tem código.
 *  - o token NUNCA aparece como texto legivel na tela sem aviso explicito;
 *  - quem confirma e o convidador, nunca o convidado (sem auto-confirmacao).
 */

const COL_INVITES = 'invites';

export const PERSONAL_TTL_H = 24;
export const TABLE_TTL_H = 4;
export const TABLE_MAX_USES = 20;

export type GeneratedInvite = { token: string; expiresAt: string; maxUses: number };

export async function generateInvite(
  profile: Profile,
  kind: 'personal' | 'table' | 'remote',
  eventName?: string,
): Promise<GeneratedInvite> {
  const ttlH = kind === 'table' ? TABLE_TTL_H : PERSONAL_TTL_H;
  const maxUses = kind === 'table' ? TABLE_MAX_USES : 1;
  const expiresAt = new Date(Date.now() + ttlH * 3600_000).toISOString();

  if (!supabase) {
    const row: Invite = {
      id: localId('invite'),
      token: cryptoToken(),
      created_by: profile.id,
      used_by: null,
      max_uses: maxUses,
      use_count: 0,
      expires_at: expiresAt,
      is_table_qr: kind === 'table',
      is_remote: kind === 'remote',
      event_name: eventName ?? null,
      created_at: new Date().toISOString(),
    };
    await insert(COL_INVITES, row);
    return { token: row.token, expiresAt, maxUses };
  }

  const res = await supabase
    .from('invites')
    .insert({
      created_by: profile.id,
      max_uses: maxUses,
      expires_at: expiresAt,
      is_table_qr: kind === 'table',
      is_remote: kind === 'remote',
      event_name: eventName ?? null,
    })
    .select('token,expires_at,max_uses')
    .single();
  if (res.error) throw res.error;
  const row = res.data as Pick<Invite, 'token' | 'expires_at' | 'max_uses'>;
  return { token: row.token, expiresAt: row.expires_at, maxUses: row.max_uses };
}

/** Convites que o usuario gerou, para ele acompanhar quem entrou. */
export async function myInvites(profile: Profile): Promise<Invite[]> {
  if (!supabase) {
    return (await all<Invite>(COL_INVITES)).filter((i) => i.created_by === profile.id);
  }
  const res = await supabase
    .from('invites')
    .select('*')
    .eq('created_by', profile.id)
    .order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return res.data as Invite[];
}

/** O QRCode codifica um deep link, nao o token cru (fluxo 4.2). */
export function inviteDeepLink(token: string): string {
  return `yvy://invite/${token}`;
}

export function parseInviteLink(scanned: string): string | null {
  const m = scanned.match(/^yvy:\/\/invite\/([0-9a-fA-F-]{36})$/);
  if (m) return m[1]!;
  if (/^[0-9a-fA-F-]{36}$/.test(scanned.trim())) return scanned.trim();
  return null;
}

/** Validacao local antes de abrir o formulario de cadastro. */
export async function peekInvite(token: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!supabase) {
    const rows = await all<Invite>(COL_INVITES);
    const row = rows.find((i) => i.token === token);
    if (!row) return { ok: false, reason: 'Convite não encontrado.' };
    if (new Date(row.expires_at) < new Date()) return { ok: false, reason: 'Este convite expirou. Peça outro.' };
    if (row.use_count >= row.max_uses) return { ok: false, reason: 'Este convite já foi utilizado.' };
    return { ok: true };
  }
  // No backend quem decide e a RPC redeem_invite (SECURITY DEFINER): o
  // cliente nao pode ler a tabela invites de outra pessoa, de proposito.
  return { ok: true };
}

/**
 * Confirmacao/rejeicao do convidado pelo convidador (fluxo 4.2, passo 10).
 *
 * Vai por RPC, nao por UPDATE: `role` e `membership_status` nao tem privilegio
 * de escrita para o cliente — senao qualquer um se promovia a admin com a anon
 * key do bundle. A RPC e SECURITY DEFINER e confere `invited_by = auth.uid()`.
 */
export async function decideInvitee(
  inviteeId: string,
  decision: 'active' | 'rejected',
): Promise<void> {
  if (!supabase) {
    // Modo local nao tem segundo aparelho, logo nao ha convidado para decidir.
    return;
  }
  const { error } = await supabase.rpc('decide_invitee', {
    p_invitee: inviteeId,
    p_decision: decision,
  });
  if (error) throw error;
}

/**
 * Convidados aguardando confirmacao deste membro.
 *
 * Tambem por RPC: `profiles` so deixa a pessoa ler a propria linha. A funcao
 * devolve apenas apelido e area — o convidador nao precisa do nome completo
 * de quem convidou para decidir.
 */
export async function pendingInvitees(_profile: Profile) {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('my_pending_invitees');
  if (error) throw error;
  return (data ?? []) as {
    id: string;
    display_name: string;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    created_at: string;
  }[];
}

export type Invitee = {
  id: string;
  display_name: string;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  membership_status: 'pending' | 'active' | 'rejected';
  created_at: string;
};

/** Todos que esta pessoa convidou, com a situação de cada um (RPC my_invitees, 0024). */
export async function myInvitees(): Promise<Invitee[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('my_invitees' as never);
  if (error) throw error;
  return (data ?? []) as unknown as Invitee[];
}

/** UUID v4 sem dependencia extra (modo local apenas). */
function cryptoToken(): string {
  const hex = [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16));
  hex[12] = '4';
  return [
    hex.slice(0, 8).join(''),
    hex.slice(8, 12).join(''),
    hex.slice(12, 16).join(''),
    hex.slice(16, 20).join(''),
    hex.slice(20, 32).join(''),
  ].join('-');
}
