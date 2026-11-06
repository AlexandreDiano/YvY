import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Member } from '@/api/members';
import { bulkTargets, isEditable, matchesFilter, namesPreview, runBulk } from '@/features/members/permissions';

const base: Member = {
  id: 'x',
  display_name: 'X',
  neighborhood: 'Centro',
  city: 'Curitiba',
  state: 'PR',
  role: 'militant',
  is_role_manager: false,
  can_invite: false,
  invited_count: 0,
  invited_by_name: null,
};
const m = (id: string, patch: Partial<Member> = {}): Member => ({ ...base, id, display_name: id, ...patch });

const sem = m('sem');
const com = m('com', { can_invite: true, invited_count: 2 });
const mod = m('mod', { role: 'moderator', can_invite: true });
const adm = m('adm', { role: 'admin', can_invite: true });
const all = [sem, com, mod, adm];

test('liberar convite só alcança membro comum que ainda não pode', () => {
  assert.deepEqual(bulkTargets(all, 'invite_on', false).map((x) => x.id), ['sem']);
  assert.deepEqual(bulkTargets(all, 'invite_off', false).map((x) => x.id), ['com']);
});

test('moderação em massa só para quem muda papéis, e nunca toca admin', () => {
  assert.deepEqual(bulkTargets(all, 'make_mod', false), []);
  assert.deepEqual(bulkTargets(all, 'make_mod', true).map((x) => x.id), ['sem', 'com']);
  assert.deepEqual(bulkTargets(all, 'remove_mod', true).map((x) => x.id), ['mod']);
});

test('ninguém edita a si mesmo nem admin', () => {
  assert.equal(isEditable(sem, 'sem'), false);
  assert.equal(isEditable(adm, 'outro'), false);
  assert.equal(isEditable(mod, 'outro'), true);
});

test('filtros da lista', () => {
  assert.deepEqual(all.filter((x) => matchesFilter(x, 'invite')).map((x) => x.id), ['com', 'mod', 'adm']);
  assert.deepEqual(all.filter((x) => matchesFilter(x, 'no_invite')).map((x) => x.id), ['sem']);
  assert.deepEqual(all.filter((x) => matchesFilter(x, 'inviters')).map((x) => x.id), ['com']);
  assert.deepEqual(all.filter((x) => matchesFilter(x, 'moderators')).map((x) => x.id), ['mod']);
});

test('em massa segue depois de uma falha e diz quem falhou', async () => {
  const done: string[] = [];
  const r = await runBulk([sem, com, mod], async (x) => {
    if (x.id === 'com') throw new Error('fora do seu bairro');
    done.push(x.id);
  });
  assert.deepEqual(done, ['sem', 'mod']);
  assert.deepEqual(r.ok.map((x) => x.id), ['sem', 'mod']);
  assert.equal(r.failed[0]?.member.id, 'com');
  assert.equal(r.failed[0]?.message, 'fora do seu bairro');
});

test('nomes na confirmação cortam depois do limite', () => {
  assert.equal(namesPreview(['A', 'B']), 'A, B');
  assert.equal(namesPreview(['A', 'B', 'C', 'D'], 2), 'A, B e mais 2');
});
