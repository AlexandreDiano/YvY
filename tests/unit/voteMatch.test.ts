import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alertable, matchTerms, title } from '@fn/vote-alerts/match';

test('termo é palavra inteira, sem acento nem maiúscula', () => {
  assert.deepEqual(matchTerms('Atendimento no Sistema Único de Saúde (SUS)', ['sus']), ['sus']);
  assert.deepEqual(matchTerms('Dispõe sobre a suspensão de prazos', ['sus']), []);
  assert.deepEqual(matchTerms('PREVIDÊNCIA social', ['previdencia']), ['previdencia']);
});

test('asterisco no fim vale como começo de palavra', () => {
  assert.deepEqual(matchTerms('critérios para aposentadoria especial', ['aposentad*']), ['aposentad*']);
  assert.deepEqual(matchTerms('representação sindical dos servidores', ['sindicat*']), []);
  assert.deepEqual(matchTerms('Dia do Síndico', ['sindicat*', 'sindical']), []);
});

test('termo com - na frente cancela o aviso', () => {
  const terms = ['trabalhador*', '-vara do trabalho'];
  assert.deepEqual(matchTerms('Direitos do trabalhador rural', terms), ['trabalhador*']);
  assert.deepEqual(matchTerms('Cria Vara do Trabalho para trabalhadores de Campinas', terms), []);
});

test('termo de várias palavras e ementa real da PEC da escala 6x1', () => {
  const ementa =
    'Altera o art. 7º da Constituição Federal para reduzir a duração máxima semanal do trabalho e prever 2 (dois) dias de repouso semanal remunerado';
  assert.deepEqual(matchTerms(ementa, ['duracao maxima semanal', 'repouso semanal']), [
    'duracao maxima semanal',
    'repouso semanal',
  ]);
});

test('lista vazia ou termo em branco não avisa', () => {
  assert.deepEqual(matchTerms('qualquer ementa', []), []);
  assert.deepEqual(matchTerms('qualquer ementa', ['  ', '*', '-']), []);
});

test('só tipo que vai a voto e muda lei', () => {
  assert.equal(alertable({ sigla: 'PEC' }), true);
  assert.equal(alertable({ sigla: 'pl' }), true);
  assert.equal(alertable({ sigla: 'REQ' }), false);
  assert.equal(alertable({ sigla: 'RQS' }), false);
});

test('título chama para a consulta pública quando ela existe', () => {
  const base = { propId: '1', numero: '00221', ano: '2019', ementa: '', sessionAt: '', url: '', sigla: 'PEC' };
  const vote = 'https://www12.senado.leg.br/ecidadania/visualizacaomateria?id=1';
  assert.equal(
    title({ ...base, casa: 'senado', urgencia: false, voteUrl: vote }),
    'Vote na consulta pública: PEC 221/2019 vai a votação no Senado',
  );
  assert.equal(
    title({ ...base, casa: 'camara', urgencia: true, voteUrl: vote }),
    'Vote na consulta pública: urgência do PEC 221/2019 vai a votação na Câmara',
  );
  // sessão do Congresso Nacional não tem consulta
  assert.equal(title({ ...base, casa: 'congresso', urgencia: false, voteUrl: null }), 'Em pauta no Congresso: PEC 221/2019');
});
