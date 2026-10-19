import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { lookupCep } from '@/lib/viacep';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function mockFetch(body: unknown, ok = true) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    return { ok, json: async () => body } as Response;
  }) as typeof fetch;
  return calls;
}

test('devolve bairro, cidade e UF, nunca a rua', async () => {
  const calls = mockFetch({
    cep: '80010-000',
    logradouro: 'Rua XV de Novembro',
    complemento: 'lado par',
    bairro: 'Centro',
    localidade: 'Curitiba',
    uf: 'PR',
  });
  const info = await lookupCep('80010-000');
  assert.deepEqual(info, { cep: '80010000', neighborhood: 'Centro', city: 'Curitiba', state: 'PR' });
  assert.ok(!JSON.stringify(info).includes('XV'), 'a rua escapou para o resultado');
  assert.equal(calls[0], 'https://viacep.com.br/ws/80010000/json/');
});

test('CEP sem bairro cai em Centro', async () => {
  mockFetch({ bairro: '', localidade: 'Pinhais', uf: 'PR' });
  assert.equal((await lookupCep('83320000')).neighborhood, 'Centro');
});

test('CEP com tamanho errado nem consulta', async () => {
  const calls = mockFetch({});
  await assert.rejects(lookupCep('8001'), /8 dígitos/);
  assert.equal(calls.length, 0);
});

test('CEP inexistente vira mensagem clara', async () => {
  mockFetch({ erro: 'true' });
  await assert.rejects(lookupCep('00000000'), /não encontrado/);
});
