import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Histórico das conversas, só neste aparelho e cifrado com a chave local
 * (secretbox; a chave fica no cofre junto com as do aparelho). Decisão de
 * 19/10: exceção à regra de não guardar dado de terceiro em disco, porque o
 * servidor não guarda conversa nenhuma.
 */
export type StoredMessage = {
  id: string;
  from: string;
  to: string;
  at: string;
  t: string;
  /** envelope assinado e assinatura, guardados para a denúncia */
  env: string;
  sig: string;
  /** aparelho que enviou */
  dev: string;
  verified: boolean;
};

export type Pins = Record<string, Record<string, string>>; // peer -> device -> signPk

const MAX = 1000;
const conv = (me: string, peer: string) => `chat:v1:${me}:c:${peer}`;
const pinsKey = (me: string) => `chat:v1:${me}:pins`;

async function readJson<T>(key: string, localKey: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  // sob demanda, como em src/api/chat.ts: libsodium fora do pacote comum
  const { unlock } = await import('@/lib/chat/crypto');
  const json = unlock(raw, localKey);
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, localKey: string, value: unknown): Promise<void> {
  const { lock } = await import('@/lib/chat/crypto');
  await AsyncStorage.setItem(key, lock(JSON.stringify(value), localKey));
}

export function readConversation(me: string, peer: string, localKey: string): Promise<StoredMessage[]> {
  return readJson<StoredMessage[]>(conv(me, peer), localKey, []);
}

/** Junta mensagens novas (sem repetir id), em ordem de data, com teto. */
export async function appendMessages(
  me: string,
  peer: string,
  localKey: string,
  add: StoredMessage[],
): Promise<StoredMessage[]> {
  const list = await readConversation(me, peer, localKey);
  const seen = new Set(list.map((m) => m.id));
  for (const m of add) if (!seen.has(m.id)) list.push(m);
  list.sort((a, b) => a.at.localeCompare(b.at));
  const kept = list.slice(-MAX);
  await writeJson(conv(me, peer), localKey, kept);
  return kept;
}

export async function deleteConversation(me: string, peer: string): Promise<void> {
  await AsyncStorage.removeItem(conv(me, peer));
}

export function readPins(me: string, localKey: string): Promise<Pins> {
  return readJson<Pins>(pinsKey(me), localKey, {});
}

export function writePins(me: string, localKey: string, pins: Pins): Promise<void> {
  return writeJson(pinsKey(me), localKey, pins);
}

/** Estado pequeno da conversa neste aparelho: o que já foi lido e a impressão digital lida no QRCode. */
export type Meta = { lastRead?: Record<string, string>; expectFp?: Record<string, string> };

const metaKey = (me: string) => `chat:v1:${me}:meta`;

export function readMeta(me: string, localKey: string): Promise<Meta> {
  return readJson<Meta>(metaKey(me), localKey, {});
}

export function writeMeta(me: string, localKey: string, meta: Meta): Promise<void> {
  return writeJson(metaKey(me), localKey, meta);
}
