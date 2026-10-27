import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSourceUrl, matchesFilter, parseBrDate, summarize, updateProblem } from '@/features/plans/promiseRules';

const today = new Date(2026, 9, 27);

test('parseBrDate aceita data válida e recusa futuro ou inválida', () => {
  assert.equal(parseBrDate('01/10/2026', today), '2026-10-01');
  assert.equal(parseBrDate('27/10/2026', today), '2026-10-27');
  assert.equal(parseBrDate('28/10/2026', today), null);
  assert.equal(parseBrDate('31/02/2026', today), null);
  assert.equal(parseBrDate('2026-10-01', today), null);
});

test('isSourceUrl exige http com domínio', () => {
  assert.ok(isSourceUrl('https://www.planalto.gov.br/x'));
  assert.ok(!isSourceUrl('planalto.gov.br'));
  assert.ok(!isSourceUrl('https://localhost'));
});

test('summarize conta sem avaliação à parte', () => {
  const s = summarize([{ status: 'fulfilled' }, { status: null }, { status: 'partial' }, { status: null }]);
  assert.equal(s.total, 4);
  assert.equal(s.fulfilled, 1);
  assert.equal(s.unrated, 2);
});

test('matchesFilter', () => {
  assert.ok(matchesFilter({ status: null }, 'unrated'));
  assert.ok(!matchesFilter({ status: 'broken' }, 'unrated'));
  assert.ok(matchesFilter({ status: 'broken' }, 'all'));
  assert.ok(matchesFilter({ status: 'broken' }, 'broken'));
});

test('updateProblem pede fonte, data e nota', () => {
  const ok = { url: 'https://www.gov.br/a', date: '01/10/2026', note: 'Decreto publicado.' };
  assert.equal(updateProblem(ok, today), null);
  assert.ok(updateProblem({ ...ok, url: '' }, today));
  assert.ok(updateProblem({ ...ok, date: '01/12/2026' }, today));
  assert.ok(updateProblem({ ...ok, note: '  ' }, today));
  assert.ok(updateProblem({ ...ok, note: 'x'.repeat(281) }, today));
});
