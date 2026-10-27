import { withCache } from '@/lib/cache';
import { electionOver } from '@/lib/format';
import { supabase } from '@/lib/supabase';

/**
 * Eleitos em 2026 (e quem foi ao 2º turno), da tabela `elected_2026`
 * (migration 0020), alimentada pelos dados abertos do TSE via
 * scripts/import-tse-elected.py. Tomam posse em 2027.
 */
export type Elected = {
  sq_candidato: string;
  cargo: string;
  uf: string;
  nome_urna: string;
  nome: string;
  partido: string;
  situacao: string;
  votos: number;
};

/** Ordem de exibição: do mais amplo ao mais local. */
export const CARGO_ORDER = [
  'Presidente',
  'Governador',
  'Senador',
  'Deputado Federal',
  'Deputado Estadual',
  'Deputado Distrital',
];

/**
 * Candidatos a presidente no momento: os dois do 2º turno até a votação; depois
 * dela, só o eleito (vazio até o resultado do TSE ser importado).
 */
export async function presidentialCandidates(): Promise<Elected[]> {
  const all = await listElected('BR');
  const over = electionOver();
  return all.filter((e) => e.cargo === 'Presidente' && (!over || e.situacao === 'ELEITO'));
}

/** `uf` null = Brasil todo (~1.700 linhas). Presidente sempre vem junto. */
export async function listElected(uf: string | null): Promise<Elected[]> {
  if (!supabase) return [];
  const { data } = await withCache(
    `elected2026:${uf ?? 'BR'}`,
    async () => {
      let query = supabase!
        .from('elected_2026' as never)
        .select('sq_candidato,cargo,uf,nome_urna,nome,partido,situacao,votos')
        .order('votos', { ascending: false })
        .limit(2000);
      if (uf) query = query.in('uf', [uf, 'BR']);
      const res = await query;
      if (res.error) throw res.error;
      return res.data as unknown as Elected[];
    },
    7 * 24 * 60 * 60 * 1000,
  );
  return data ?? [];
}

export type PlanItem = { tema: string; texto: string; pagina: number };
export type GovernmentPlan = {
  sq_candidato: string;
  nome_urna: string;
  cargo: string;
  uf: string;
  partido: string;
  pdf_url: string;
  pages: number | null;
  items: PlanItem[];
  verified: boolean;
};

/** Plano de governo oficial (PDF do TSE + trechos conferidos), migration 0027. */
export async function getGovernmentPlan(sq: string): Promise<GovernmentPlan | null> {
  if (!supabase) return null;
  const { data } = await withCache(
    `plan:${sq}`,
    async () => {
      const res = await supabase!
        .from('government_plans' as never)
        .select('sq_candidato,nome_urna,cargo,uf,partido,pdf_url,pages,items,verified')
        .eq('sq_candidato', sq)
        .maybeSingle();
      if (res.error) throw res.error;
      return res.data as unknown as GovernmentPlan | null;
    },
    7 * 24 * 60 * 60 * 1000,
  );
  return data ?? null;
}

/** Link para uma página do PDF (leitores de PDF do celular e do navegador aceitam #page). */
export function planPageUrl(plan: Pick<GovernmentPlan, 'pdf_url'>, page?: number): string {
  return page ? `${plan.pdf_url}#page=${page}` : plan.pdf_url;
}

/** Temas fixos para comparar os planos, com as palavras que indicam cada um. */
export const PLAN_THEMES: { key: string; label: string; words: string[] }[] = [
  { key: 'saude', label: 'Saúde', words: ['saúde', 'sus', 'hospital', 'médic', 'remédio'] },
  { key: 'educacao', label: 'Educação', words: ['educa', 'escola', 'ensino', 'universidad', 'professor'] },
  { key: 'seguranca', label: 'Segurança', words: ['segurança', 'crime', 'polícia', 'polici', 'presíd', 'violência'] },
  { key: 'economia', label: 'Emprego e economia', words: ['emprego', 'trabalh', 'salário', 'renda', 'impost', 'tribut', 'econom'] },
  { key: 'social', label: 'Programas sociais', words: ['bolsa', 'fome', 'pobreza', 'assistência', 'social'] },
  { key: 'ambiente', label: 'Meio ambiente', words: ['ambient', 'clima', 'amazônia', 'desmat', 'sustent'] },
];

/** Planos dos candidatos a presidente, em ordem alfabética (ordem neutra). */
export async function presidentialPlans(): Promise<GovernmentPlan[]> {
  const candidates = await presidentialCandidates();
  const plans = await Promise.all(candidates.map((c) => getGovernmentPlan(c.sq_candidato).catch(() => null)));
  return plans
    .filter((p): p is GovernmentPlan => !!p && p.verified)
    .sort((a, b) => a.nome_urna.localeCompare(b.nome_urna, 'pt-BR'));
}

/** Trechos de um plano sobre um tema (busca nas palavras do tema, no tema e no texto). */
export function planItemsFor(plan: GovernmentPlan, themeKey: string, max = 2): PlanItem[] {
  const theme = PLAN_THEMES.find((t) => t.key === themeKey);
  if (!theme) return [];
  return plan.items
    .filter((i) => {
      const t = `${i.tema} ${i.texto}`.toLowerCase();
      return theme.words.some((w) => t.includes(w));
    })
    .slice(0, max);
}
