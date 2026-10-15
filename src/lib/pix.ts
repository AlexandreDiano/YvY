/**
 * Pix "copia e cola" estático (BR Code do Banco Central), sem valor: quem
 * paga digita quanto quiser no app do banco. O mesmo texto vira o QRCode.
 *
 * Campos EMV, cada um com ID, tamanho em 2 dígitos e valor:
 *   00 formato, 26 conta (GUI br.gov.bcb.pix + chave), 52 categoria,
 *   53 moeda 986 (real), 58 país, 59 nome, 60 cidade, 62 txid "***",
 *   63 CRC16-CCITT de tudo, incluindo o "6304".
 */
function field(id: string, value: string): string {
  return id + String(value.length).padStart(2, '0') + value;
}

/** Banco aceita só ASCII sem acento em nome e cidade. */
function plain(text: string, max: number): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .toUpperCase()
    .slice(0, max);
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function pixPayload(key: string, name: string, city: string): string {
  const body =
    field('00', '01') +
    field('26', field('00', 'br.gov.bcb.pix') + field('01', key.trim())) +
    field('52', '0000') +
    field('53', '986') +
    field('58', 'BR') +
    field('59', plain(name, 25) || 'YVY') +
    field('60', plain(city, 15) || 'BRASIL') +
    field('62', field('05', '***')) +
    '6304';
  return body + crc16(body);
}
