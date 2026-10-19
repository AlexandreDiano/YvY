import type * as Crypto from '@/lib/chat/crypto';
import { readSecret, writeSecret } from '@/lib/chat/keys';
import {
  appendMessages,
  readConversation,
  readMeta,
  readPins,
  updateMeta,
  writePins,
  type StoredMessage,
} from '@/lib/chat/store';
import { supabase } from '@/lib/supabase';

/**
 * Conversas 1:1 com criptografia de ponta a ponta (0050).
 *
 * O servidor só guarda texto cifrado, por aparelho de destino, até o
 * destinatário baixar (no máximo 7 dias). O histórico fica no aparelho
 * (src/lib/chat/store.ts). Sem Supabase não existe conversa: não há como
 * entregar mensagem a outro aparelho, então o modo local só avisa.
 */

/**
 * libsodium só carrega quando alguém abre Conversas: import estático aqui
 * levava o módulo (e o WASM do site) para o pacote comum de todas as telas.
 */
let loading: Promise<typeof Crypto> | null = null;
function sodium(): Promise<typeof Crypto> {
  loading ??= import('@/lib/chat/crypto').then(async (m) => {
    await m.ready();
    return m;
  });
  return loading;
}

export const MAX_TEXT = 2000;
export const REPORT_LAST = 20;

type Secret = Crypto.DeviceKeys & { deviceId: string; localKey: string };

export type Contact = {
  contactId: string;
  peerId: string;
  name: string;
  neighborhood: string | null;
  city: string | null;
  status: 'pending' | 'accepted';
  incoming: boolean;
  blocked: boolean;
  createdAt: string;
};

export type PeerDevice = { id: string; boxPk: string; signPk: string; fingerprint: string };

export type PeerKeys = {
  devices: PeerDevice[];
  /** Apareceu aparelho que não estava aqui da última vez (troca de celular ou chave nova). */
  newDevice: boolean;
  /** Impressão digital lida no QRCode bate com a chave atual: null quando não teve QRCode. */
  qrMatch: boolean | null;
};

function client() {
  if (!supabase) throw new Error('Conversas precisam do servidor: neste modo de teste local não há como entregar mensagens.');
  return supabase;
}

function friendly(err: unknown, fallback: string): Error {
  const msg = (err as { message?: string } | null)?.message ?? '';
  if (/row-level security|42501|permission/i.test(msg)) return new Error('Não dá para mandar: a conversa não foi aceita ou alguém bloqueou.');
  return new Error(msg || fallback);
}

// ---------------------------------------------------------------- aparelho

let current: { userId: string; secret: Promise<Secret> } | null = null;

/**
 * Chaves deste aparelho. Primeira vez: gera, registra a pública e guarda a
 * privada no cofre. Se o servidor apagou o aparelho (saiu em outro lugar),
 * registra de novo com as mesmas chaves.
 */
export function ensureDevice(userId: string): Promise<Secret> {
  // uma promessa só por conta: as telas chamam em paralelo ao abrir, e duas
  // chamadas no primeiro uso registrariam dois aparelhos
  if (current?.userId !== userId) {
    const secret = setupDevice(userId);
    current = { userId, secret };
    secret.catch(() => {
      if (current?.secret === secret) current = null;
    });
  }
  return current.secret;
}

async function setupDevice(userId: string): Promise<Secret> {
  const C = await sodium();
  const db = client();

  const raw = await readSecret(userId);
  let secret: Secret | null = raw ? (JSON.parse(raw) as Secret) : null;

  if (secret) {
    const { data } = await db.from('chat_devices').select('id').eq('id', secret.deviceId).maybeSingle();
    if (!data) {
      const again = await db
        .from('chat_devices')
        .insert({ user_id: userId, box_pk: secret.boxPk, sign_pk: secret.signPk })
        .select('id')
        .single();
      if (again.error) throw friendly(again.error, 'Não foi possível preparar as conversas neste aparelho.');
      secret = { ...secret, deviceId: again.data.id };
      await writeSecret(userId, JSON.stringify(secret));
    }
  } else {
    const keys = C.generateDeviceKeys();
    const ins = await db
      .from('chat_devices')
      .insert({ user_id: userId, box_pk: keys.boxPk, sign_pk: keys.signPk })
      .select('id')
      .single();
    if (ins.error) throw friendly(ins.error, 'Não foi possível preparar as conversas neste aparelho.');
    secret = { ...keys, deviceId: ins.data.id, localKey: C.newLocalKey() };
    await writeSecret(userId, JSON.stringify(secret));
  }
  return secret;
}

export async function myFingerprint(userId: string): Promise<string> {
  const C = await sodium();
  return C.fingerprint((await ensureDevice(userId)).signPk);
}

// ---------------------------------------------------------------- contatos

export async function listContacts(): Promise<Contact[]> {
  const { data, error } = await client().rpc('chat_contacts_list');
  if (error) throw friendly(error, 'Não foi possível carregar as conversas.');
  return (data ?? []).map((r) => ({
    contactId: r.contact_id,
    peerId: r.peer_id,
    name: r.peer_name,
    neighborhood: r.peer_neighborhood,
    city: r.peer_city,
    status: r.status as Contact['status'],
    incoming: r.incoming,
    blocked: r.blocked,
    createdAt: r.created_at,
  }));
}

export async function newAddCode(): Promise<{ code: string; expiresAt: string }> {
  const { data, error } = await client().rpc('chat_new_add_code');
  const row = data?.[0];
  if (error || !row) throw friendly(error, 'Não foi possível gerar o código.');
  return { code: row.code, expiresAt: row.expires_at };
}

/** Lê "CODIGO" ou o link do QRCode (…/conversas/adicionar?c=CODIGO&f=IMPRESSAO). */
export function parseAddLink(raw: string): { code: string; fp: string | null } {
  const text = raw.trim();
  try {
    const url = new URL(text);
    return { code: (url.searchParams.get('c') ?? '').toUpperCase(), fp: url.searchParams.get('f') };
  } catch {
    return { code: text.replace(/\s+/g, '').toUpperCase(), fp: null };
  }
}

/** Pede para conversar com o dono do código. Com a impressão do QRCode, ela fica guardada para conferir a chave. */
export async function addByCode(me: string, raw: string): Promise<void> {
  const { code, fp } = parseAddLink(raw);
  if (code.length !== 10) throw new Error('O código tem 10 letras e números.');
  const { data, error } = await client().rpc('chat_request_contact', { p_code: code });
  if (error) throw friendly(error, 'Não foi possível adicionar.');
  if (fp && data) {
    const peer = (await listContacts()).find((c) => c.contactId === data)?.peerId;
    if (peer) {
      const secret = await ensureDevice(me);
      await updateMeta(me, secret.localKey, (m) => ({ ...m, expectFp: { ...m.expectFp, [peer]: fp } }));
    }
  }
}

export async function decideContact(contactId: string, accept: boolean): Promise<void> {
  const { error } = await client().rpc('chat_decide_contact', { p_contact: contactId, p_accept: accept });
  if (error) throw friendly(error, 'Não foi possível responder ao pedido.');
}

export async function blockPeer(peer: string): Promise<void> {
  const { error } = await client().rpc('chat_block', { p_user: peer });
  if (error) throw friendly(error, 'Não foi possível bloquear.');
}

export async function unblockPeer(peer: string): Promise<void> {
  const { error } = await client().rpc('chat_unblock', { p_user: peer });
  if (error) throw friendly(error, 'Não foi possível desbloquear.');
}

export async function listBlocked(): Promise<{ peerId: string; name: string; neighborhood: string | null; at: string }[]> {
  const { data, error } = await client().rpc('chat_blocked_list');
  if (error) throw friendly(error, 'Não foi possível carregar a lista.');
  return (data ?? []).map((r) => ({ peerId: r.peer_id, name: r.peer_name, neighborhood: r.peer_neighborhood, at: r.created_at }));
}

// ---------------------------------------------------------------- chaves dos outros

/**
 * Aparelhos do contato, conferidos com os guardados aqui (confiança no
 * primeiro uso, como no Signal). No primeiro contato guarda tudo; depois,
 * aparelho novo fica marcado até a pessoa ver o aviso na conversa
 * (acceptPeerKeys). A mensagem segue cifrada para ele mesmo assim: senão o
 * contato que trocou de celular não leria nada.
 */
export async function peerKeys(me: string, peer: string): Promise<PeerKeys> {
  const C = await sodium();
  const secret = await ensureDevice(me);
  const { data, error } = await client().rpc('chat_peer_devices', { p_peer: peer });
  if (error) throw friendly(error, 'Não foi possível buscar a chave do contato.');
  const devices = (data ?? []).map((d) => ({ id: d.id, boxPk: d.box_pk, signPk: d.sign_pk, fingerprint: C.fingerprint(d.sign_pk) }));

  const pins = await readPins(me, secret.localKey);
  const known = pins[peer];
  if (!known && devices.length) {
    pins[peer] = Object.fromEntries(devices.map((d) => [d.id, d.signPk]));
    await writePins(me, secret.localKey, pins);
  }
  const newDevice = Boolean(known) && devices.some((d) => known![d.id] !== d.signPk);

  const fp = (await readMeta(me, secret.localKey)).expectFp?.[peer] ?? null;
  const norm = (x: string) => x.replace(/\s/g, '').toUpperCase();
  const qrMatch = fp ? devices.some((d) => norm(d.fingerprint) === norm(fp)) : null;
  return { devices, newDevice, qrMatch };
}

/** A pessoa viu o aviso de aparelho novo: passa a valer como conhecido. */
export async function acceptPeerKeys(me: string, peer: string): Promise<void> {
  const secret = await ensureDevice(me);
  const { data } = await client().rpc('chat_peer_devices', { p_peer: peer });
  const pins = await readPins(me, secret.localKey);
  pins[peer] = Object.fromEntries((data ?? []).map((d) => [d.id, d.sign_pk]));
  await writePins(me, secret.localKey, pins);
}

// ---------------------------------------------------------------- mensagens

export async function readMessages(me: string, peer: string): Promise<StoredMessage[]> {
  const secret = await ensureDevice(me);
  return readConversation(me, peer, secret.localKey);
}

export async function sendMessage(me: string, peer: string, text: string): Promise<StoredMessage[]> {
  const t = text.trim();
  if (!t) return readMessages(me, peer);
  if (t.length > MAX_TEXT) throw new Error(`Mensagem longa demais (até ${MAX_TEXT} caracteres).`);
  const C = await sodium();
  const secret = await ensureDevice(me);
  const { devices } = await peerKeys(me, peer);
  if (!devices.length) throw new Error('Essa pessoa ainda não abriu Conversas em nenhum aparelho. Quando abrir, dá para mandar.');

  const id = C.uuid();
  const at = new Date().toISOString();
  const env = C.envelopeText({ id, from: me, to: peer, at, t });
  const sig = C.sign(env, secret.signSk);
  const rows = devices.map((d) => ({
    msg_id: id,
    sender: me,
    sender_device: secret.deviceId,
    recipient: peer,
    recipient_device: d.id,
    ...C.seal(env, sig, d.boxPk, secret.boxSk),
  }));
  const { error } = await client().from('message_queue').insert(rows);
  if (error) throw friendly(error, 'Não foi possível enviar.');
  return appendMessages(me, peer, secret.localKey, [{ id, from: me, to: peer, at, t, env, sig, dev: secret.deviceId, verified: true }]);
}

/**
 * Baixa o que chegou para ESTE aparelho, decifra, guarda no histórico e
 * apaga da fila. Filtra pelo aparelho também no apagar: a RLS enxerga a
 * conta, não o aparelho, e apagar a cópia de outro aparelho perderia a
 * mensagem lá.
 */
export async function fetchInbox(me: string): Promise<Record<string, number>> {
  const C = await sodium();
  const secret = await ensureDevice(me);
  const db = client();
  const { data, error } = await db
    .from('message_queue')
    .select('id, msg_id, sender, sender_device, nonce, body')
    .eq('recipient_device', secret.deviceId)
    .order('created_at')
    .limit(200);
  if (error) throw friendly(error, 'Não foi possível baixar as mensagens.');
  if (!data?.length) return {};

  const bySender = new Map<string, typeof data>();
  for (const row of data) bySender.set(row.sender, [...(bySender.get(row.sender) ?? []), row]);

  const added: Record<string, number> = {};
  // só sai da fila o que foi resolvido: aberto, ou impossível de abrir
  // (aparelho de origem sumiu, texto adulterado). Se a busca da chave falhou
  // (rede), fica para a próxima vez.
  const done: string[] = [];
  for (const [sender, rows] of bySender) {
    let devices: PeerDevice[];
    try {
      devices = (await peerKeys(me, sender)).devices;
    } catch {
      continue;
    }
    const opened: StoredMessage[] = [];
    for (const row of rows) {
      const dev = devices.find((d) => d.id === row.sender_device);
      if (!dev) {
        done.push(row.id);
        continue;
      }
      const got = C.open({ nonce: row.nonce, body: row.body }, dev.boxPk, dev.signPk, secret.boxSk, {
        id: row.msg_id,
        from: sender,
        to: me,
      });
      done.push(row.id);
      if (!got) continue;
      opened.push({ id: row.msg_id, from: sender, to: me, at: got.env.at, t: got.env.t, env: got.text, sig: got.sig, dev: dev.id, verified: got.verified });
    }
    if (opened.length) {
      await appendMessages(me, sender, secret.localKey, opened);
      added[sender] = opened.length;
    }
  }

  if (done.length) {
    await db.from('message_queue').delete().eq('recipient_device', secret.deviceId).in('id', done);
  }
  return added;
}

/** Avisa quando chega mensagem para este aparelho. Devolve a função de parar. */
export function watchInbox(deviceId: string, onNew: () => void): () => void {
  if (!supabase) return () => undefined;
  const db = supabase;
  const channel = db
    .channel(`inbox:${deviceId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_queue', filter: `recipient_device=eq.${deviceId}` }, onNew)
    .subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}

export async function lastRead(me: string): Promise<Record<string, string>> {
  const secret = await ensureDevice(me);
  return (await readMeta(me, secret.localKey)).lastRead ?? {};
}

export async function markRead(me: string, peer: string): Promise<void> {
  const secret = await ensureDevice(me);
  await updateMeta(me, secret.localKey, (m) => ({ ...m, lastRead: { ...m.lastRead, [peer]: new Date().toISOString() } }));
}

// ---------------------------------------------------------------- denúncia

/**
 * Envia à moderação as últimas mensagens desta conversa, decifradas aqui. O
 * servidor junta os IPs e as chaves de assinatura; cada mensagem vai com a
 * assinatura de quem escreveu, então ninguém consegue inventar fala do outro.
 */
export async function reportPeer(me: string, peer: string, block: boolean): Promise<void> {
  const list = (await readMessages(me, peer)).slice(-REPORT_LAST);
  const messages = list.map((m) => ({ id: m.id, from: m.from, at: m.at, env: m.env, sig: m.sig, dev: m.dev }));
  const { error } = await client().rpc('chat_report', { p_reported: peer, p_messages: messages, p_block: block });
  if (error) throw friendly(error, 'Não foi possível enviar a denúncia.');
}

export type ReportMessage = { id: string; from: string; at: string; text: string | null; verified: boolean; byReported: boolean };

export type ChatReport = {
  id: string;
  reporterName: string | null;
  reportedId: string;
  reportedName: string | null;
  area: string;
  blocked: boolean;
  status: 'open' | 'resolved';
  resolution: string | null;
  reporterIp: string | null;
  reportedIps: { ip: string; last_seen: string }[];
  createdAt: string;
  messages: ReportMessage[];
};

/** Denúncias que a moderação pode ver (RLS: moderador do bairro do denunciado e admin), já conferidas. */
export async function listReports(status: 'open' | 'resolved' = 'open'): Promise<ChatReport[]> {
  const C = await sodium();
  const { data, error } = await client()
    .from('chat_reports')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw friendly(error, 'Não foi possível carregar as denúncias.');
  return (data ?? []).map((r) => {
    const keys = (r.sign_keys ?? {}) as Record<string, { user: string; sign_pk: string }>;
    const raw = (Array.isArray(r.messages) ? r.messages : []) as { id: string; from: string; at: string; env: string; sig: string; dev: string }[];
    const messages = raw.map((m) => {
      const key = keys[m.dev];
      let text: string | null = null;
      let ok = false;
      try {
        const env = JSON.parse(m.env) as { id?: string; from?: string; t?: string };
        text = typeof env.t === 'string' ? env.t : null;
        ok = Boolean(key) && key!.user === m.from && env.id === m.id && env.from === m.from && C.verify(m.env, m.sig, key!.sign_pk);
      } catch {
        ok = false;
      }
      return { id: m.id, from: m.from, at: m.at, text, verified: ok, byReported: m.from === r.reported };
    });
    return {
      id: r.id,
      reporterName: r.reporter_name,
      reportedId: r.reported,
      reportedName: r.reported_name,
      area: [r.reported_neighborhood, r.reported_city].filter(Boolean).join(', '),
      blocked: r.blocked,
      status: r.status as ChatReport['status'],
      resolution: r.resolution,
      reporterIp: r.reporter_ip,
      reportedIps: (r.reported_ips ?? []) as ChatReport['reportedIps'],
      createdAt: r.created_at,
      messages,
    };
  });
}

export async function resolveReport(id: string, resolution: string): Promise<void> {
  const { error } = await client().rpc('chat_resolve_report', { p_id: id, p_resolution: resolution });
  if (error) throw friendly(error, 'Não foi possível resolver a denúncia.');
}
