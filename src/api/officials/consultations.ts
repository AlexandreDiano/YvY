import { Platform } from 'react-native';
import { DAY, HOUR, cached } from '@/api/officials/shared';

// ------------------------------------------------------- consultas públicas

const ECIDADANIA = 'https://www12.senado.leg.br/ecidadania';
/**
 * De onde a lista é lida. O Senado não libera CORS, então no site o pedido vai
 * para o nosso domínio e a Vercel repassa ao e-Cidadania (rewrite no
 * vercel.json). O link de votar continua indo direto para o Senado.
 */
const ECIDADANIA_FETCH = Platform.OS === 'web' ? '/ecidadania' : ECIDADANIA;

export type Consultation = {
  id: string;
  /** "PL 4439/2025" */
  label: string;
  /** Ementa como o Senado publica. */
  text: string;
  yes: number;
  no: number;
  /** Página onde a pessoa vota (exige cadastro no Senado). */
  url: string;
};

function decodeHtml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lê a lista de consultas abertas da página pública do e-Cidadania. */
export function parseConsultations(html: string): Consultation[] {
  const out: Consultation[] = [];
  const seen = new Set<string>();
  for (const block of html.split('resumo-materia').slice(1)) {
    const head = block.match(/visualizacaomateria\?id=(\d+)"[^>]*>([^<]+)<\/a>/);
    const body = block.match(/<section>\s*<a [^>]*>([^<]+)<\/a>/);
    const nums = block.match(/<header>\s*<span>([\d.]+)<\/span>\s*<span>([\d.]+)<\/span>/);
    if (!head || !body || !nums) continue;
    const id = head[1]!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label: decodeHtml(head[2]!),
      text: decodeHtml(body[1]!),
      yes: Number(nums[1]!.replace(/\./g, '')),
      no: Number(nums[2]!.replace(/\./g, '')),
      url: `${ECIDADANIA}/visualizacaomateria?id=${id}`,
    });
  }
  return out;
}

/**
 * Consultas públicas abertas no e-Cidadania, na ordem da página. O Senado não
 * tem API para isso e o app lê a página pública. Se o layout mudar a lista
 * vem vazia e a tela mostra o link direto. No navegador passa pelo rewrite da
 * Vercel (ECIDADANIA_FETCH).
 */
export async function listConsultations(page = 1): Promise<{ list: Consultation[]; stale: boolean }> {
  const { data, stale } = await cached(
    `consultas:v2:${page}`,
    async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        // 100 por página, e o e-Cidadania tem dezenas de páginas
        const res = await fetch(`${ECIDADANIA_FETCH}/pesquisamateria?p=${page}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`e-Cidadania respondeu ${res.status}.`);
        const list = parseConsultations(await res.text());
        if (!list.length) throw new Error('Não foi possível ler a lista do e-Cidadania.');
        return list;
      } finally {
        clearTimeout(timer);
      }
    },
    3 * HOUR,
    7 * DAY,
  );
  return { list: data ?? [], stale };
}

export const ECIDADANIA_URL = `${ECIDADANIA}/pesquisamateria`;
