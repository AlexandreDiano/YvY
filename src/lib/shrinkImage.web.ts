import type { Shrunk } from '@/lib/shrinkImage';

export type { Shrunk } from '@/lib/shrinkImage';

/**
 * No navegador o seletor ignora `quality` e entrega o arquivo original. Print
 * de celular em PNG passa de 3 MB (o OCR recusava) e foto de câmera vem com o
 * EXIF, GPS incluído. Redesenhar num canvas e exportar JPEG resolve as duas
 * coisas: diminui e o arquivo novo sai sem metadado nenhum.
 */
export async function shrinkImage(
  asset: { uri: string; base64?: string | null; mimeType?: string | null },
  opts: { maxSide?: number; quality?: number } = {},
): Promise<Shrunk | null> {
  const maxSide = opts.maxSide ?? 1600;
  const quality = opts.quality ?? 0.75;
  const src = asset.uri || (asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : '');
  if (!src) return null;

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = src;
  });
  if (!img || !img.naturalWidth) return null;

  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // fundo branco, senão PNG com transparência fica preto no JPEG
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { uri: dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' };
}
