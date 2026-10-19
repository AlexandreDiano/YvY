import assert from 'node:assert/strict';
import { test } from 'node:test';

import { camarada, formatCep, formatPhone, suggestDisplayName } from '@/lib/format';
import { pixPayload } from '@/lib/pix';

test('apelido sugerido nunca carrega o nome completo', () => {
  assert.equal(suggestDisplayName('José da Silva Santos'), 'J.S.');
  assert.equal(suggestDisplayName('maria'), 'M.');
  assert.equal(suggestDisplayName('   '), '');
});

test('"Camarada" aparece uma vez só', () => {
  assert.equal(camarada('J.S.'), 'Camarada J.S.');
  assert.equal(camarada('Camarada A.D.'), 'Camarada A.D.');
  assert.equal(camarada(null), 'Camarada');
});

test('máscaras de CEP e telefone', () => {
  assert.equal(formatCep('80010000999'), '80010-000');
  assert.equal(formatPhone('41998765432'), '(41) 99876-5432');
  assert.equal(formatPhone('4133334444'), '(41) 3333-4444');
});

// CRC16-CCITT-FALSE escrito de outro jeito (tabela), para não testar o código
// contra ele mesmo.
function crcTable(s: string): string {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n << 8;
    for (let k = 0; k < 8; k++) c = c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1;
    return c & 0xffff;
  });
  let crc = 0xffff;
  for (const ch of s) crc = ((crc << 8) ^ table[((crc >> 8) ^ ch.charCodeAt(0)) & 0xff]!) & 0xffff;
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

test('Pix copia e cola: campos e CRC batem', () => {
  const p = pixPayload('apoio@exemplo.org', 'Coletivo Ação', 'São José');
  assert.ok(p.startsWith('000201'));
  assert.ok(p.includes('0014br.gov.bcb.pix0117apoio@exemplo.org'));
  assert.ok(p.includes('5913COLETIVO ACAO'));
  assert.ok(p.includes('6008SAO JOSE'));
  assert.equal(p.slice(-4), crcTable(p.slice(0, -4)));
});
