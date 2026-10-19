import assert from 'node:assert/strict';
import { before, test } from 'node:test';

import {
  envelopeText,
  fingerprint,
  generateDeviceKeys,
  lock,
  newLocalKey,
  open,
  ready,
  seal,
  sign,
  unlock,
  verify,
} from '@/lib/chat/crypto';

before(async () => {
  await ready();
});

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const C = 'cccccccc-0000-4000-8000-000000000003';

function message(id: string, from: string, to: string, t = 'oi, camarada') {
  return envelopeText({ id, from, to, at: '2026-10-19T12:00:00.000Z', t });
}

test('ida e volta: B decifra, confere a assinatura e lê o texto', () => {
  const a = generateDeviceKeys();
  const b = generateDeviceKeys();
  const env = message('m1', A, B);
  const sealed = seal(env, sign(env, a.signSk), b.boxPk, a.boxSk);
  const got = open(sealed, a.boxPk, a.signPk, b.boxSk, { id: 'm1', from: A, to: B });
  assert.ok(got);
  assert.equal(got.env.t, 'oi, camarada');
  assert.equal(got.verified, true);
  assert.ok(!sealed.body.includes('camarada'), 'texto puro na fila');
});

test('texto cifrado alterado não abre', () => {
  const a = generateDeviceKeys();
  const b = generateDeviceKeys();
  const env = message('m2', A, B);
  const sealed = seal(env, sign(env, a.signSk), b.boxPk, a.boxSk);
  const flipped = sealed.body.slice(0, 10) + (sealed.body[10] === 'A' ? 'B' : 'A') + sealed.body.slice(11);
  assert.equal(open({ ...sealed, body: flipped }, a.boxPk, a.signPk, b.boxSk, { id: 'm2', from: A, to: B }), null);
});

test('terceiro com a chave dele não decifra', () => {
  const a = generateDeviceKeys();
  const b = generateDeviceKeys();
  const c = generateDeviceKeys();
  const env = message('m3', A, B);
  const sealed = seal(env, sign(env, a.signSk), b.boxPk, a.boxSk);
  assert.equal(open(sealed, a.boxPk, a.signPk, c.boxSk, { id: 'm3', from: A, to: B }), null);
});

test('mensagem reaproveitada em outra conversa é descartada', () => {
  // B recebe de A e tenta repassar a C como se A tivesse escrito para C
  const a = generateDeviceKeys();
  const b = generateDeviceKeys();
  const c = generateDeviceKeys();
  const env = message('m4', A, B);
  const sig = sign(env, a.signSk);
  const resealed = seal(env, sig, c.boxPk, b.boxSk);
  assert.equal(open(resealed, b.boxPk, a.signPk, c.boxSk, { id: 'm4', from: A, to: C }), null);
  assert.equal(open(resealed, b.boxPk, a.signPk, c.boxSk, { id: 'm4', from: B, to: C }), null);
});

test('assinatura prova autoria: texto forjado por quem recebeu não confere', () => {
  const a = generateDeviceKeys();
  const b = generateDeviceKeys();
  const real = message('m5', A, B, 'vamos às 18h');
  const sig = sign(real, a.signSk);
  assert.equal(verify(real, sig, a.signPk), true);
  const forged = message('m5', A, B, 'algo que A nunca disse');
  assert.equal(verify(forged, sig, a.signPk), false);
  assert.equal(verify(forged, sign(forged, b.signSk), a.signPk), false);
});

test('histórico local só abre com a chave do aparelho', () => {
  const key = newLocalKey();
  const stored = lock('{"m":[1,2]}', key);
  assert.equal(unlock(stored, key), '{"m":[1,2]}');
  assert.equal(unlock(stored, newLocalKey()), null);
  assert.ok(!stored.includes('"m"'));
});

test('impressão digital estável e curta', () => {
  const a = generateDeviceKeys();
  assert.equal(fingerprint(a.signPk), fingerprint(a.signPk));
  assert.match(fingerprint(a.signPk), /^([0-9A-F]{4} ){4}[0-9A-F]{4}$/);
});

test('uuid v4 válido e diferente a cada vez', async () => {
  const { uuid } = await import('@/lib/chat/crypto');
  const a = uuid();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, uuid());
});
