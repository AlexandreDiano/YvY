import { BILL_TYPES, type Bill, CAMARA, DAY, HOUR, MANDATE, type Official, SENADO, cached, getJson, outcomeOf, withCamaraOutcomes } from '@/api/officials/shared';

type CamaraBill = {
  id: number;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa: string;
  dataApresentacao: string;
};

function camaraBill(p: CamaraBill): Bill {
  return {
    id: String(p.id),
    label: `${p.siglaTipo} ${p.numero}/${p.ano}`,
    text: p.ementa,
    date: p.dataApresentacao.slice(0, 10),
    status: null,
    url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`,
  };
}

type SenadoProcesso = {
  id: string | number;
  identificacao: string;
  ementa: string;
  dataApresentacao: string;
  codigoMateria: string | null;
  situacaoAtual: string | null;
  dataSituacaoAtual?: string | null;
  normaGerada?: string | null;
};

/**
 * Proposições em que o parlamentar é autor ou coautor, mais recentes primeiro.
 * Coautoria conta: PEC no Senado precisa de 27 assinaturas, e a API do Senado
 * não separa primeiro signatário. A tela diz "autor ou coautor".
 */
export type BillScope = 'mandate' | 'career';

/**
 * `mandate`: só deste mandato. `career`: tudo que a API tem do parlamentar
 * (Câmara desde 2001; Senado, toda a autoria registrada), até 50 itens, e o
 * total para dar a dimensão do trabalho.
 */
export async function listBills(
  official: Official,
  scope: BillScope = 'mandate',
): Promise<{ bills: Bill[]; total: number; stale: boolean }> {
  const limit = scope === 'career' ? 50 : 10;
  const { data, stale } = await cached(
    `bills:v4:${scope}:${official.house}:${official.id}`,
    async () => {
      if (official.house === 'camara') {
        const res = await fetch(
          `${CAMARA}/proposicoes?idDeputadoAutor=${official.id}&siglaTipo=${BILL_TYPES.join(',')}` +
            (scope === 'mandate' ? `&dataApresentacaoInicio=${MANDATE.congress}` : '') +
            `&ordem=DESC&ordenarPor=id&itens=${limit}`,
          { headers: { Accept: 'application/json' } },
        );
        if (!res.ok) throw new Error(`Fonte oficial respondeu ${res.status}.`);
        const total = Number(res.headers.get('x-total-count') ?? 0);
        const { dados } = (await res.json()) as { dados: CamaraBill[] };
        return { bills: await withCamaraOutcomes(dados.map(camaraBill)), total: total || dados.length };
      }
      // A API não filtra por data nem por tipo (~300 KB só o que tramita, ~1 MB
      // com a carreira toda), por isso só busca quando a pessoa toca no senador.
      const list = await getJson<SenadoProcesso[]>(
        `${SENADO}/processo?codigoParlamentarAutor=${official.id}` + (scope === 'mandate' ? '&tramitando=S' : ''),
      );
      const own = list
        .filter((p) => BILL_TYPES.includes(p.identificacao.split(' ')[0] ?? ''))
        .filter((p) => scope === 'career' || p.dataApresentacao >= MANDATE.congress)
        .sort((a, b) => b.dataApresentacao.localeCompare(a.dataApresentacao));
      const bills = own
        .slice(0, limit)
        .map<Bill>((p) => ({
          id: String(p.id), // a API manda número, apesar do nome
          label: p.identificacao,
          text: p.ementa,
          date: p.dataApresentacao.slice(0, 10),
          status: p.normaGerada ? `${p.situacaoAtual ?? ''} · ${p.normaGerada}`.replace(/^ · /, '') : p.situacaoAtual,
          outcome: outcomeOf(p.situacaoAtual, p.dataSituacaoAtual, p.normaGerada),
          url: p.codigoMateria
            ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${p.codigoMateria}`
            : official.url,
        }));
      return { bills, total: own.length };
    },
    6 * HOUR,
    DAY,
  );
  return { bills: data?.bills ?? [], total: data?.total ?? 0, stale };
}

/** Medidas provisórias, o ato com força de lei que a Presidência edita sozinha. */
export async function listPresidentialMeasures(): Promise<{ bills: Bill[]; stale: boolean }> {
  const { data, stale } = await cached(
    'bills:v2:presidencia',
    async () => {
      const { dados } = await getJson<{ dados: CamaraBill[] }>(
        `${CAMARA}/proposicoes?siglaTipo=MPV&dataApresentacaoInicio=${MANDATE.executive}` +
          `&ordem=DESC&ordenarPor=id&itens=10`,
      );
      return dados.map(camaraBill);
    },
    6 * HOUR,
    DAY,
  );
  return { bills: data ?? [], stale };
}
