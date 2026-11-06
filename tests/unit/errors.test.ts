import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ptError, ptMessage } from '@/lib/errors';

test('erro do Auth em inglês vira português pelo código', () => {
  assert.equal(ptMessage({ code: 'email_exists', message: 'A user with this email address has already been registered' }), 'Esse e-mail já é de outra conta.');
  assert.equal(ptMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }), 'E-mail ou senha não conferem.');
});

test('falha ao mandar e-mail (SMTP) e falha de rede viram frase nossa', () => {
  assert.match(ptMessage({ status: 500, code: 'unexpected_failure', message: 'Error sending email change email' }), /mandar o e-mail/);
  assert.match(ptMessage(new TypeError('Failed to fetch')), /Sem conexão/);
});

test('RLS e código do Postgres em português', () => {
  assert.equal(ptMessage({ code: '42501', message: 'new row violates row-level security policy for table "posts"' }), 'Você não tem permissão para fazer isso.');
});

test('mensagem das nossas RPCs (já em português) passa como veio', () => {
  assert.equal(ptMessage({ code: 'P0001', message: 'Você já denunciou este post.' }), 'Você já denunciou este post.');
});

test('inglês desconhecido nunca chega à tela', () => {
  assert.equal(ptMessage({ message: 'Something unexpected happened' }, 'Não deu.'), 'Não deu.');
});

test('ptError guarda o código para quem decide por ele', () => {
  const e = ptError({ code: 'email_not_confirmed', message: 'Email not confirmed' }) as Error & { code?: string };
  assert.equal(e.code, 'email_not_confirmed');
  assert.match(e.message, /Confirme o e-mail/);
});
