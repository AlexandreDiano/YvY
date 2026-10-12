/**
 * Imagem pronta para enviar: no celular o seletor já comprimiu (`quality`) e
 * regravou a imagem — o que também tira o EXIF (GPS de onde a foto foi
 * tirada). Aqui não há o que fazer. Versão do site: shrinkImage.web.ts.
 */
export type Shrunk = { uri: string; base64: string; mimeType: string };

export async function shrinkImage(
  asset: { uri: string; base64?: string | null; mimeType?: string | null },
  _opts?: { maxSide?: number; quality?: number },
): Promise<Shrunk | null> {
  if (!asset.base64) return null;
  return { uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' };
}
