import assert from 'node:assert/strict';
import { test } from 'node:test';

import { safeUrl, scrub, scrubDeep } from '@/lib/monitoring.shared';

test('tira e-mail, CPF, CEP, telefone e id', () => {
  const out = scrub(
    'maria.silva+x@gmail.com cpf 123.456.789-09 cep 80010-000 tel (41) 99876-5432 ' +
      'id 3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b',
  );
  for (const leak of ['maria', 'gmail', '123.456', '80010', '99876', '3f2b8c1e']) {
    assert.ok(!out.includes(leak), `vazou "${leak}" em: ${out}`);
  }
  assert.match(out, /\[email\]/);
  assert.match(out, /\[cep\]/);
  assert.match(out, /\[telefone\]/);
  assert.match(out, /\[id\]/);
});

test('números sem máscara também saem', () => {
  for (const raw of ['12345678909', '80010000', '41998765432', '+55 41 99876-5432']) {
    assert.ok(!/\d{8}/.test(scrub(`valor ${raw} fim`).replace(/\D/g, '')), `sobrou ${raw}`);
  }
});

test('texto sem dado pessoal passa intacto', () => {
  const msg = 'Falha ao carregar o feed do bairro (tentativa 2 de 3)';
  assert.equal(scrub(msg), msg);
});

test('scrubDeep entra em objeto e lista, mas preserva a pilha', () => {
  const event = {
    message: 'erro para joao@exemplo.com',
    extra: { contatos: ['(11) 91234-5678'] },
    stacktrace: { frames: [{ filename: 'app-80010000.js' }] },
  };
  const out = scrubDeep(event);
  assert.equal(out.message, 'erro para [email]');
  assert.deepEqual(out.extra.contatos, ['[telefone]']);
  assert.equal(out.stacktrace.frames[0]!.filename, 'app-80010000.js');
});

test('safeUrl corta query e fragmento e troca id', () => {
  assert.equal(
    safeUrl('https://www.useyvy.app/acoes/3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b?email=a@b.com#x'),
    'https://www.useyvy.app/acoes/[id]',
  );
  assert.equal(safeUrl(42), undefined);
});
