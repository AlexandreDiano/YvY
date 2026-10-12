import { Linking, Platform } from 'react-native';

/**
 * Pix "copia e cola" estático (BR Code do Banco Central), sem valor: quem
 * paga digita quanto quiser no app do banco. Mesmo texto vira o QRCode Pix.
 *
 * Campos (EMV, cada um ID + tamanho com 2 dígitos + valor):
 *   00 formato · 26 conta (GUI br.gov.bcb.pix + chave) · 52 categoria ·
 *   53 moeda 986 (real) · 58 país · 59 nome · 60 cidade · 62 txid "***" ·
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

/**
 * Apps de banco no Android (pacote da Play Store). Não existe link universal
 * para "abrir o banco": cada app é aberto pelo pacote, e no iPhone a Apple não
 * deixa abrir app de terceiro sem ele declarar um link próprio — lá a pessoa
 * abre o banco sozinha e usa o copia e cola.
 */
export const BANKS: { name: string; pkg: string }[] = [
  { name: 'Nubank', pkg: 'com.nu.production' },
  { name: 'Itaú', pkg: 'com.itau' },
  { name: 'Bradesco', pkg: 'com.bradesco' },
  { name: 'Banco do Brasil', pkg: 'br.com.bb.android' },
  { name: 'Caixa', pkg: 'br.com.gabba.Caixa' },
  { name: 'Santander', pkg: 'com.santander.app' },
  { name: 'Inter', pkg: 'br.com.intermedium' },
  { name: 'C6', pkg: 'com.c6bank.app' },
  { name: 'PicPay', pkg: 'com.picpay' },
  { name: 'Mercado Pago', pkg: 'com.mercadopago.wallet' },
];

/** Só Android sabe abrir um app pelo pacote. */
export function canOpenBank(): boolean {
  if (Platform.OS === 'android') return true;
  return Platform.OS === 'web' && typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent);
}

/**
 * Site no Chrome do Android: link `intent:` abre o app direto (ou a Play
 * Store, se não estiver instalado). APK: React Native não abre `intent:`, então
 * vai pela página do app na Play Store, que tem o botão "Abrir".
 */
export async function openBank(pkg: string): Promise<void> {
  if (Platform.OS === 'web') {
    const store = encodeURIComponent(`https://play.google.com/store/apps/details?id=${pkg}`);
    window.location.href = `intent://#Intent;package=${pkg};S.browser_fallback_url=${store};end`;
    return;
  }
  await Linking.openURL(`market://details?id=${pkg}`).catch(() =>
    Linking.openURL(`https://play.google.com/store/apps/details?id=${pkg}`),
  );
}
