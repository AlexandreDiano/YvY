import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Invite, Profile } from '@/lib/db.types';
import { env } from '@/lib/env';
import { all, insert, localId, patch } from '@/lib/localStore';
import { supabase } from '@/lib/supabase';

/**
 * Convites por QRCode presencial (fluxo 4.2), em duas etapas (0035):
 *
 *  1. Escanear: `claimInvite` reserva uma vaga e devolve um segredo que fica
 *     só neste aparelho (AsyncStorage, nunca na URL). Janela curta:
 *       pessoal 2 min · mesa 5 min por QRCode (troca sozinho, até 20 pessoas
 *       e 4h no evento) · distância 24h (código de texto).
 *  2. Cadastrar: `redeem_invite` com o segredo, em até 24h — dá tempo de
 *     preencher o formulário e confirmar o e-mail.
 *
 * Prazos saem do relógio do servidor (trigger da 0035); os daqui são só para
 * o modo local e para os textos da tela.
 *  - o token NUNCA aparece como texto legivel na tela sem aviso explicito;
 *  - quem confirma e o convidador, nunca o convidado (sem auto-confirmacao).
 */

const COL_INVITES = 'invites';

export const PERSONAL_SCAN_MIN = 2;
export const TABLE_SCAN_MIN = 5;
export const TABLE_TTL_H = 4;
export const TABLE_MAX_USES = 20;
export const REMOTE_TTL_H = 24;
/** Prazo para terminar o cadastro depois de escanear. */
export const CLAIM_TTL_H = 24;

export type GeneratedInvite = {
  id: string;
  token: string;
  /** Fim do convite inteiro (evento de 4h na mesa). */
  expiresAt: string;
  /** Até quando este QRCode pode ser escaneado. */
  scanExpiresAt: string;
  maxUses: number;
  /**
   * Relógio do servidor menos o do aparelho, medido ao gerar. Os horários
   * acima já vêm convertidos para o relógio do aparelho: com janela de 2 min,
   * celular com hora errada mostraria contagem errada.
   */
  skewMs: number;
};

const toLocal = (iso: string, skewMs: number) => new Date(new Date(iso).getTime() - skewMs).toISOString();

function windows(kind: 'personal' | 'table' | 'remote') {
  const now = Date.now();
  if (kind === 'remote') {
    const end = new Date(now + REMOTE_TTL_H * 3600_000).toISOString();
    return { expiresAt: end, scanExpiresAt: end, maxUses: 1 };
  }
  if (kind === 'table') {
    return {
      expiresAt: new Date(now + TABLE_TTL_H * 3600_000).toISOString(),
      scanExpiresAt: new Date(now + TABLE_SCAN_MIN * 60_000).toISOString(),
      maxUses: TABLE_MAX_USES,
    };
  }
  const end = new Date(now + PERSONAL_SCAN_MIN * 60_000).toISOString();
  return { expiresAt: end, scanExpiresAt: end, maxUses: 1 };
}

export async function generateInvite(
  profile: Profile,
  kind: 'personal' | 'table' | 'remote',
  eventName?: string,
): Promise<GeneratedInvite> {
  const w = windows(kind);

  if (!supabase) {
    const row: Invite = {
      id: localId('invite'),
      token: cryptoToken(),
      created_by: profile.id,
      used_by: null,
      max_uses: w.maxUses,
      use_count: 0,
      expires_at: w.expiresAt,
      scan_expires_at: w.scanExpiresAt,
      is_table_qr: kind === 'table',
      is_remote: kind === 'remote',
      event_name: eventName ?? null,
      created_at: new Date().toISOString(),
    };
    await insert(COL_INVITES, row);
    return { id: row.id, token: row.token, ...w, skewMs: 0 };
  }

  // Prazos e vagas: quem define é o trigger do banco, pelo relógio do servidor.
  const res = await supabase
    .from('invites')
    .insert({
      created_by: profile.id,
      max_uses: w.maxUses,
      expires_at: w.expiresAt,
      scan_expires_at: w.scanExpiresAt,
      is_table_qr: kind === 'table',
      is_remote: kind === 'remote',
      event_name: eventName ?? null,
    })
    .select('id,token,expires_at,scan_expires_at,max_uses')
    .single();
  if (res.error) throw res.error;
  const row = res.data as Pick<Invite, 'id' | 'token' | 'expires_at' | 'scan_expires_at' | 'max_uses'>;
  // O servidor abriu a janela agora; quanto ela "sobra" além do esperado é a
  // diferença de relógio (mais a latência, que é de segundos).
  const skewMs = new Date(row.scan_expires_at).getTime() - new Date(w.scanExpiresAt).getTime();
  return {
    id: row.id,
    token: row.token,
    expiresAt: toLocal(row.expires_at, skewMs),
    scanExpiresAt: toLocal(row.scan_expires_at, skewMs),
    maxUses: row.max_uses,
    skewMs,
  };
}

/**
 * QRCode de mesa: token novo a cada 5 min, mesma linha no banco — as 20 vagas
 * e as 4h valem para o evento inteiro. Foto do QRCode morre na troca.
 */
export async function rotateTableInvite(inv: GeneratedInvite): Promise<GeneratedInvite> {
  if (!supabase) {
    const token = cryptoToken();
    const scanExpiresAt = new Date(
      Math.min(Date.now() + TABLE_SCAN_MIN * 60_000, new Date(inv.expiresAt).getTime()),
    ).toISOString();
    await patch<Invite>(COL_INVITES, inv.id, { token, scan_expires_at: scanExpiresAt });
    return { ...inv, token, scanExpiresAt };
  }
  const { data, error } = await supabase.rpc('rotate_table_invite', { p_invite: inv.id });
  if (error) throw error;
  const row = (data as { token: string; scan_expires_at: string }[])[0]!;
  return { ...inv, token: row.token, scanExpiresAt: toLocal(row.scan_expires_at, inv.skewMs) };
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

/**
 * O QRCode codifica um link, nao o token cru (fluxo 4.2).
 *
 * Com o site configurado, é https://<site>/cadastro/convite#t=<token>: a
 * câmera de qualquer celular abre, no navegador, a tela de convite do PWA; o
 * leitor do APK entende o mesmo link. O token vai depois do `#` de propósito:
 * fragmento não é enviado ao servidor, então não fica em log da Vercel nem em
 * Referer.
 *
 * Sem site configurado (modo local, APK sem EXPO_PUBLIC_SITE_URL), cai no
 * yvy://invite/<token> antigo, que só o app lê.
 */
export function inviteDeepLink(token: string): string {
  const base = env.siteUrl || (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : '');
  return base ? `${base}/cadastro/convite#t=${token}` : `yvy://invite/${token}`;
}

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

/** Aceita o link https novo, o yvy:// antigo e o código digitado. */
export function parseInviteLink(scanned: string): string | null {
  const text = scanned.trim();
  const m =
    text.match(new RegExp(`^yvy://invite/(${UUID})$`)) ??
    text.match(new RegExp(`^https://[^/\\s]+/cadastro/convite[?#]t=(${UUID})$`)) ??
    text.match(new RegExp(`^(${UUID})$`));
  return m ? m[1]! : null;
}

/** Reserva guardada no aparelho entre o scan e o fim do cadastro. */
export type InviteClaim = { claim: string; expiresAt: string };

const CLAIM_KEY = 'yvy:invite-claim';

/**
 * Etapa 1: reserva a vaga na hora do scan. Roda sem conta (`anon`), por isso
 * só devolve o segredo — nada sobre quem convidou nem sobre o convite.
 * O segredo vai para o AsyncStorage, nunca para a URL: no site, parâmetro de
 * rota acaba na barra de endereço, no histórico e no log do servidor.
 */
export async function claimInvite(token: string): Promise<InviteClaim> {
  let result: InviteClaim;
  if (!supabase) {
    const rows = await all<Invite>(COL_INVITES);
    const row = rows.find((i) => i.token === token);
    if (!row) throw new Error('Convite não encontrado.');
    const now = new Date();
    if (new Date(row.scan_expires_at ?? row.expires_at) < now || new Date(row.expires_at) < now) {
      throw new Error('Este QRCode expirou. Peça para gerar outro.');
    }
    if (row.use_count >= row.max_uses) throw new Error('Este convite já foi utilizado.');
    await patch<Invite>(COL_INVITES, row.id, { use_count: row.use_count + 1 });
    result = { claim: token, expiresAt: new Date(Date.now() + CLAIM_TTL_H * 3600_000).toISOString() };
  } else {
    const { data, error } = await supabase.rpc('claim_invite', { p_token: token });
    if (error) throw new Error(error.message);
    const row = (data as { claim: string; claim_expires_at: string }[])[0]!;
    result = { claim: row.claim, expiresAt: row.claim_expires_at };
  }
  await AsyncStorage.setItem(CLAIM_KEY, JSON.stringify(result));
  return result;
}

/** Reserva ainda válida neste aparelho, ou null. */
export async function storedClaim(): Promise<InviteClaim | null> {
  try {
    const raw = await AsyncStorage.getItem(CLAIM_KEY);
    const c = raw ? (JSON.parse(raw) as InviteClaim) : null;
    if (!c || new Date(c.expiresAt) < new Date()) return null;
    return c;
  } catch {
    return null;
  }
}

export async function clearClaim(): Promise<void> {
  await AsyncStorage.removeItem(CLAIM_KEY);
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
