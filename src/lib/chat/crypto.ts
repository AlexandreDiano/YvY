import sodium from 'react-native-libsodium';

/**
 * Criptografia das conversas, toda em libsodium (nada feito à mão):
 *
 *   cifra       crypto_box_easy (X25519 + XSalsa20-Poly1305), uma cópia por
 *               aparelho do destinatário, com nonce aleatório
 *   autoria     crypto_sign_detached (Ed25519) sobre o envelope. O crypto_box
 *               sozinho não prova quem escreveu (o destinatário tem a mesma
 *               chave de sessão e poderia forjar), e a denúncia precisa disso
 *   histórico   crypto_secretbox_easy com uma chave local do aparelho
 *
 * No APK roda nativo (JSI); no site, libsodium-wrappers em WASM. Este módulo
 * só é importado pelas telas de Conversas, para o WASM não pesar o resto.
 */

export type DeviceKeys = { boxPk: string; boxSk: string; signPk: string; signSk: string };

/** O que vai assinado e cifrado. A ordem dos campos é fixa: a assinatura é sobre o texto exato. */
export type Envelope = { v: 1; id: string; from: string; to: string; at: string; t: string };

export type Sealed = { nonce: string; body: string };

const b64 = (u: Uint8Array) => sodium.to_base64(u);
const unb64 = (s: string) => sodium.from_base64(s);

export const ready = () => sodium.ready;

export function generateDeviceKeys(): DeviceKeys {
  const box = sodium.crypto_box_keypair();
  const sign = sodium.crypto_sign_keypair();
  return {
    boxPk: b64(box.publicKey),
    boxSk: b64(box.privateKey),
    signPk: b64(sign.publicKey),
    signSk: b64(sign.privateKey),
  };
}

export function envelopeText(e: Omit<Envelope, 'v'>): string {
  const ordered: Envelope = { v: 1, id: e.id, from: e.from, to: e.to, at: e.at, t: e.t };
  return JSON.stringify(ordered);
}

export function sign(text: string, signSk: string): string {
  return b64(sodium.crypto_sign_detached(text, unb64(signSk)));
}

export function verify(text: string, sig: string, signPk: string): boolean {
  try {
    return sodium.crypto_sign_verify_detached(unb64(sig), text, unb64(signPk));
  } catch {
    return false;
  }
}

/** Cifra envelope + assinatura para um aparelho. */
export function seal(env: string, sig: string, toBoxPk: string, myBoxSk: string): Sealed {
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const body = sodium.crypto_box_easy(JSON.stringify({ e: env, s: sig }), nonce, unb64(toBoxPk), unb64(myBoxSk));
  return { nonce: b64(nonce), body: b64(body) };
}

export type Opened = { env: Envelope; text: string; sig: string; verified: boolean };

/**
 * Decifra e confere. `expect` vem da linha da fila (quem o servidor diz que
 * mandou, para quem, id): envelope que não bate é descartado, para ninguém
 * reaproveitar uma mensagem assinada em outra conversa.
 */
export function open(
  sealed: Sealed,
  fromBoxPk: string,
  fromSignPk: string,
  myBoxSk: string,
  expect: { id: string; from: string; to: string },
): Opened | null {
  let plain: string;
  try {
    plain = sodium.to_string(
      sodium.crypto_box_open_easy(unb64(sealed.body), unb64(sealed.nonce), unb64(fromBoxPk), unb64(myBoxSk)),
    );
  } catch {
    return null;
  }
  let outer: { e?: unknown; s?: unknown };
  let env: Envelope;
  try {
    outer = JSON.parse(plain) as { e?: unknown; s?: unknown };
    if (typeof outer.e !== 'string' || typeof outer.s !== 'string') return null;
    env = JSON.parse(outer.e) as Envelope;
  } catch {
    return null;
  }
  if (env.v !== 1 || env.id !== expect.id || env.from !== expect.from || env.to !== expect.to) return null;
  if (typeof env.t !== 'string' || typeof env.at !== 'string') return null;
  return { env, text: outer.e, sig: outer.s, verified: verify(outer.e, outer.s, fromSignPk) };
}

/** Impressão digital curta da chave de assinatura, para comparar em pessoa. */
export function fingerprint(signPk: string): string {
  const hex = sodium.to_hex(sodium.crypto_generichash(10, unb64(signPk), null));
  return (hex.match(/.{4}/g) ?? []).join(' ').toUpperCase();
}

/** UUID v4 com o gerador do libsodium (o Hermes não tem crypto.randomUUID). */
export function uuid(): string {
  const b = sodium.randombytes_buf(16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = sodium.to_hex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function newLocalKey(): string {
  return b64(sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES));
}

export function lock(json: string, key: string): string {
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  return `${b64(nonce)}.${b64(sodium.crypto_secretbox_easy(json, nonce, unb64(key)))}`;
}

export function unlock(stored: string, key: string): string | null {
  const [n, c] = stored.split('.');
  if (!n || !c) return null;
  try {
    return sodium.to_string(sodium.crypto_secretbox_open_easy(unb64(c), unb64(n), unb64(key)));
  } catch {
    return null;
  }
}
