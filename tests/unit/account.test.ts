import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  areaChanged,
  cepChanged,
  emailProblem,
  isDeleteConfirmed,
  passwordProblem,
} from '@/features/account/rules';

test('troca de senha: pede a atual, 8 caracteres, repetição igual e senha diferente', () => {
  assert.match(passwordProblem('', 'novasenha1', 'novasenha1') ?? '', /senha atual/);
  assert.match(passwordProblem('velha123', 'curta', 'curta') ?? '', /8 caracteres/);
  assert.match(passwordProblem('velha123', 'novasenha1', 'novasenha2') ?? '', /não são iguais/);
  assert.match(passwordProblem('mesma1234', 'mesma1234', 'mesma1234') ?? '', /diferente/);
  assert.equal(passwordProblem('velha123', 'novasenha1', 'novasenha1'), null);
});

test('troca de e-mail: formato e e-mail igual ao atual', () => {
  assert.match(emailProblem('a@b.com', 'sem-arroba') ?? '', /válido/);
  assert.match(emailProblem('a@b.com', '  A@B.com ') ?? '', /já é/);
  assert.equal(emailProblem('a@b.com', 'novo@b.com'), null);
  assert.equal(emailProblem(null, 'novo@b.com'), null);
});

test('apagar conta só com APAGAR digitado', () => {
  assert.equal(isDeleteConfirmed('APAGAR'), true);
  assert.equal(isDeleteConfirmed('  apagar '), true);
  assert.equal(isDeleteConfirmed('apaga'), false);
  assert.equal(isDeleteConfirmed(''), false);
});

test('CEP só conta como mudado com 8 dígitos e diferente do atual', () => {
  assert.equal(cepChanged('80010000', '80010-000'), false);
  assert.equal(cepChanged('80010000', '8001'), false);
  assert.equal(cepChanged('80010000', '83005-000'), true);
  assert.equal(cepChanged(null, '83005-000'), true);
});

test('mudança de área ignora maiúscula e espaço', () => {
  const a = { neighborhood: 'Centro', city: 'Curitiba', state: 'PR' };
  assert.equal(areaChanged(a, { neighborhood: ' centro', city: 'CURITIBA', state: 'pr' }), false);
  assert.equal(areaChanged(a, { neighborhood: 'Centro', city: 'São José dos Pinhais', state: 'PR' }), true);
});
