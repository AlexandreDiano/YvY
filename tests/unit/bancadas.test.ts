import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LEGISLATURAS } from '@/data/bancadas';
import { TOP_COLORED, assignSeats, hemicycle, partyColorSlots, seatsByParty, thresholds } from '@/features/bancadas/seats';

const sum = (xs: { seats: number }[]) => xs.reduce((a, x) => a + x.seats, 0);

test('cada legislatura tem 513 deputados e 81 senadores (3 por UF)', () => {
  for (const l of LEGISLATURAS) {
    assert.equal(sum(seatsByParty(l.camara)), 513, `Câmara ${l.legislatura}`);
    if (l.senado) {
      assert.equal(sum(seatsByParty(l.senado)), 81, `Senado ${l.legislatura}`);
      for (const uf of Object.keys(l.senado)) assert.equal(sum(seatsByParty(l.senado, uf)), 3, `${uf} ${l.legislatura}`);
    }
  }
  assert.equal(LEGISLATURAS[0]?.senado, null);
});

test('maiorias saem do tamanho da casa', () => {
  assert.deepEqual(thresholds(513), { majority: 257, amendment: 308 });
  assert.deepEqual(thresholds(81), { majority: 41, amendment: 49 });
});

test('desenho tem exatamente n cadeiras, sem sobrepor', () => {
  for (const n of [513, 81, 3, 1]) {
    const { seats, dot } = hemicycle(n);
    assert.equal(seats.length, n);
    let min = Infinity;
    for (let i = 0; i < seats.length; i++)
      for (let j = i + 1; j < seats.length; j++)
        min = Math.min(min, Math.hypot(seats[i]!.x - seats[j]!.x, seats[i]!.y - seats[j]!.y));
    if (n > 1) assert.ok(min >= 2 * dot, `n=${n}: distância ${min} < diâmetro ${2 * dot}`);
  }
});

test('cada partido ocupa um bloco seguido', () => {
  const order = assignSeats([
    { party: 'A', seats: 3 },
    { party: 'B', seats: 2 },
  ]);
  assert.deepEqual(order, ['A', 'A', 'A', 'B', 'B']);
});

test('cor fixa por partido, sem repetir entre os maiores do mesmo ano', () => {
  const slots = partyColorSlots(LEGISLATURAS);
  for (const l of LEGISLATURAS) {
    for (const b of [l.camara, l.senado]) {
      if (!b) continue;
      const top = seatsByParty(b).slice(0, TOP_COLORED).map((x) => slots.get(x.party));
      assert.ok(top.every((s) => s !== undefined), `sem cor entre os maiores de ${l.legislatura}`);
      assert.equal(new Set(top).size, top.length, `cor repetida em ${l.legislatura}`);
    }
  }
});
