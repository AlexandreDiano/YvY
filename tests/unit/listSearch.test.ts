import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PAGE, filterBy, fold, page } from '@/features/officials/listSearch';

type Item = { label: string; text: string };
const mpvs: Item[] = [
  { label: 'MPV 1303/2025', text: 'Dispõe sobre a tributação de aplicações financeiras' },
  { label: 'MPV 1286/2025', text: 'Altera a Lei nº 14.133, de licitações' },
  { label: 'MPV 1185/2023', text: 'Institui o Programa de Aceleração do Crescimento' },
];
const toText = (m: Item) => `${m.label} ${m.text}`;

test('fold tira acento, cedilha e maiúscula', () => {
  assert.equal(fold('  São PAULO '), 'sao paulo');
  assert.equal(fold('Aceleração'), 'aceleracao');
  assert.equal(fold('ÇÃÕÉÍÚ'), 'caoeiu');
});

test('busca ignora acento e maiúscula', () => {
  assert.deepEqual(filterBy(mpvs, 'ACELERACAO', toText), [mpvs[2]]);
  assert.deepEqual(filterBy(mpvs, 'tributação', toText), [mpvs[0]]);
  assert.deepEqual(
    filterBy([{ name: 'José Antônio' }, { name: 'Maria' }], 'jose antonio', (o) => o.name),
    [{ name: 'José Antônio' }],
  );
});

test('busca por número, ano e palavras em qualquer ordem', () => {
  assert.deepEqual(filterBy(mpvs, '1286', toText), [mpvs[1]]);
  assert.deepEqual(filterBy(mpvs, '2025', toText), [mpvs[0], mpvs[1]]);
  assert.deepEqual(filterBy(mpvs, 'mpv 1185/2023', toText), [mpvs[2]]);
  assert.deepEqual(filterBy(mpvs, 'licitações lei', toText), [mpvs[1]]);
});

test('busca vazia devolve tudo; sem resultado devolve lista vazia', () => {
  assert.deepEqual(filterBy(mpvs, '', toText), mpvs);
  assert.deepEqual(filterBy(mpvs, '   ', toText), mpvs);
  assert.deepEqual(filterBy(mpvs, 'xyzzy', toText), []);
});

test('ver mais: primeiro lote, próximo lote e fim da lista', () => {
  const list = Array.from({ length: 25 }, (_, i) => i);
  const first = page(list, PAGE);
  assert.equal(first.visible.length, PAGE);
  assert.equal(first.remaining, 15);
  assert.equal(first.next, PAGE);

  const second = page(list, PAGE * 2);
  assert.equal(second.visible.length, 20);
  assert.equal(second.remaining, 5);
  assert.equal(second.next, 5);

  const end = page(list, PAGE * 3);
  assert.equal(end.visible.length, 25);
  assert.equal(end.remaining, 0);
  assert.equal(end.next, 0);
});

test('lista curta não tem ver mais', () => {
  const three = page(['a', 'b', 'c'], PAGE);
  assert.deepEqual(three.visible, ['a', 'b', 'c']);
  assert.equal(three.remaining, 0);
  assert.deepEqual(page([], PAGE), { visible: [], remaining: 0, next: 0 });
});
