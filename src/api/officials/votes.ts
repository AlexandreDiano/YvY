import { type Ballot, CAMARA, DAY, HOUR, type House, SENADO, type Vote, type VoteStep, cached, getJson, isoDay } from '@/api/officials/shared';

// ---------------------------------------------------------------- votações

type CamaraVote = {
  id: string;
  data: string;
  descricao: string;
  uriEvento: string | null;
};
type CamaraAuthor = { uri: string; nome: string; codTipo: number; ordemAssinatura: number };
type CamaraDeputyStatus = { ultimoStatus: { siglaPartido: string; siglaUf: string } };

/** codTipo 10000 = deputado(a). Outros: Poder Executivo, Senado, comissões. */
const CAMARA_DEPUTY = 10000;

type CamaraVoteDetail = {
  proposicoesAfetadas?: { id: number; siglaTipo: string; numero: number; ano: number; ementa: string }[];
};

async function camaraVotes(): Promise<Vote[]> {
  // idOrgao 180 = Plenário. Comissões votam centenas de requerimentos por semana.
  const { dados } = await getJson<{ dados: CamaraVote[] }>(
    `${CAMARA}/votacoes?idOrgao=180&ordem=DESC&ordenarPor=dataHoraRegistro&itens=15`,
  );
  // A lista não diz qual proposição foi votada ("Aprovada a Redação Final."),
  // o detalhe diz. Só para essas 15, em paralelo, e se uma falha as outras seguem.
  const details = await Promise.allSettled(
    dados.map((v) => getJson<{ dados: CamaraVoteDetail }>(`${CAMARA}/votacoes/${v.id}`)),
  );
  const props = dados.map((_, i) => {
    const d = details[i];
    return d?.status === 'fulfilled' ? d.value.dados.proposicoesAfetadas?.[0] : undefined;
  });
  const authors = await camaraAuthors([...new Set(props.flatMap((p) => (p ? [p.id] : [])))]);
  return dados.map((v, i) => {
    const prop = props[i];
    const by = prop ? authors.get(prop.id) : undefined;
    const eventId = v.uriEvento?.split('/').pop();
    return {
      id: `camara-${v.id}`,
      house: 'camara',
      date: v.data,
      label: prop ? `${prop.siglaTipo} ${prop.numero}/${prop.ano}` : null,
      text: prop?.ementa ?? v.descricao,
      detail: prop ? v.descricao : null,
      author: by?.name ?? null,
      coauthors: by?.coauthors ?? 0,
      // a ficha da proposição lista as votações dela; sem proposição, usa a sessão
      url: prop
        ? `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${prop.id}`
        : eventId
        ? `https://www.camara.leg.br/evento-legislativo/${eventId}`
        : 'https://www.camara.leg.br/busca-portal/proposicoes/pesquisa-simplificada',
    };
  });
}

/**
 * Primeiro signatário de cada proposição. A lista de autores vem fora de
 * ordem, então ordena por `ordemAssinatura`. Partido e UF são os atuais do
 * deputado, a API não guarda os da época.
 */
async function camaraAuthors(propIds: number[]): Promise<Map<number, { name: string; coauthors: number }>> {
  const lists = await Promise.allSettled(
    propIds.map((id) => getJson<{ dados: CamaraAuthor[] }>(`${CAMARA}/proposicoes/${id}/autores`)),
  );
  const firsts = new Map<number, { first: CamaraAuthor; total: number }>();
  lists.forEach((r, i) => {
    if (r.status !== 'fulfilled' || !r.value.dados.length) return;
    const sorted = [...r.value.dados].sort((a, b) => a.ordemAssinatura - b.ordemAssinatura);
    firsts.set(propIds[i]!, { first: sorted[0]!, total: sorted.length });
  });

  const depUris = [
    ...new Set([...firsts.values()].filter((f) => f.first.codTipo === CAMARA_DEPUTY).map((f) => f.first.uri)),
  ];
  const statuses = await Promise.allSettled(depUris.map((uri) => getJson<{ dados: CamaraDeputyStatus }>(uri)));
  const tag = new Map<string, string>();
  statuses.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      const st = r.value.dados.ultimoStatus;
      tag.set(depUris[i]!, `${st.siglaPartido}/${st.siglaUf}`);
    }
  });

  const out = new Map<number, { name: string; coauthors: number }>();
  for (const [id, { first, total }] of firsts) {
    const t = tag.get(first.uri);
    out.set(id, { name: t ? `${first.nome} (${t})` : first.nome, coauthors: total - 1 });
  }
  return out;
}

type SenadoVote = {
  codigoSessaoVotacao: number;
  codigoMateria: number | null;
  dataSessao: string;
  identificacao: string | null;
  ementa: string | null;
  descricaoVotacao: string;
  resultadoVotacao: string | null;
  totalVotosSim: number | null;
  totalVotosNao: number | null;
  totalVotosAbstencao: number | null;
  votacaoSecreta: string | null;
  votos?: {
    nomeParlamentar: string;
    siglaPartidoParlamentar: string | null;
    siglaUFParlamentar: string | null;
    siglaVotoParlamentar: string | null;
  }[];
};

const SENADO_RESULT: Record<string, string> = { A: 'Aprovado', R: 'Rejeitado' };

/**
 * Autoria da matéria como o Senado publica: "Senador Fulano (PARTIDO/UF),
 * Senadora Beltrana (PARTIDO/UF), ...". Fica o primeiro, conta o resto.
 */
async function senadoAuthors(codes: number[]): Promise<Map<number, { name: string; coauthors: number }>> {
  const res = await Promise.allSettled(
    codes.map((c) => getJson<{ autoria?: string }[]>(`${SENADO}/processo?codigoMateria=${c}`)),
  );
  const out = new Map<number, { name: string; coauthors: number }>();
  res.forEach((r, i) => {
    const autoria = r.status === 'fulfilled' ? r.value[0]?.autoria?.trim() : undefined;
    if (!autoria) return;
    const parts = autoria.split(/(?<=\)),\s*/);
    const first = parts[0]!.replace(/^Senador(a)?\s+/, '');
    out.set(codes[i]!, { name: first, coauthors: parts.length - 1 });
  });
  return out;
}

async function senadoVotes(): Promise<Vote[]> {
  // Cada item traz o voto de todos os 81 senadores: 90 dias já são ~200 KB.
  const end = new Date();
  const start = new Date(end.getTime() - 90 * DAY);
  const list = await getJson<SenadoVote[]>(
    `${SENADO}/votacao?dataInicio=${isoDay(start)}&dataFim=${isoDay(end)}`,
  );
  const authors = await senadoAuthors([
    ...new Set(list.flatMap((v) => (v.codigoMateria ? [v.codigoMateria] : []))),
  ]);
  // Projeto que veio da Câmara tem "Câmara dos Deputados" como autor formal.
  // Quem propôs de fato está na Câmara, então busca lá pela sigla/número/ano.
  // Só vale de 2019 em diante, quando as casas passaram a usar numeração única;
  // antes disso o mesmo número pode ser outro projeto.
  const fromCamara = new Map<string, number>(); // "PLP 74/2026" -> id na Câmara
  const origin = [
    ...new Set(
      list
        .filter((v) => v.codigoMateria && authors.get(v.codigoMateria)?.name === 'Câmara dos Deputados')
        .map((v) => v.identificacao?.match(/^[A-Z]+ \d+\/\d{4}/)?.[0])
        .filter((ident): ident is string => !!ident && Number(ident.slice(-4)) >= 2019),
    ),
  ];
  await Promise.allSettled(
    origin.map(async (ident) => {
      const [, sigla, numero, ano] = ident.match(/^([A-Z]+) (\d+)\/(\d{4})/)!;
      const { dados } = await getJson<{ dados: { id: number }[] }>(
        `${CAMARA}/proposicoes?siglaTipo=${sigla}&numero=${numero}&ano=${ano}&itens=1`,
      );
      if (dados[0]) fromCamara.set(ident, dados[0].id);
    }),
  );
  const camaraBy = await camaraAuthors([...new Set(fromCamara.values())]);

  return list.map((v) => {
    const ident = v.identificacao?.match(/^[A-Z]+ \d+\/\d{4}/)?.[0];
    const camaraId = ident ? fromCamara.get(ident) : undefined;
    const by =
      (camaraId ? camaraBy.get(camaraId) : undefined) ??
      (v.codigoMateria ? authors.get(v.codigoMateria) : undefined);
    const result = v.resultadoVotacao ? SENADO_RESULT[v.resultadoVotacao] ?? null : null;
    const tally =
      v.totalVotosSim != null && v.votacaoSecreta !== 'S'
        ? `Sim: ${v.totalVotosSim}; Não: ${v.totalVotosNao ?? 0}; Abstenção: ${v.totalVotosAbstencao ?? 0}`
        : null;
    return {
      id: `senado-${v.codigoSessaoVotacao}`,
      house: 'senado',
      date: v.dataSessao,
      label: v.identificacao,
      text: v.ementa ?? v.descricaoVotacao,
      detail: [v.descricaoVotacao, result, tally].filter(Boolean).join(' · ') || null,
      author: by?.name ?? null,
      coauthors: by?.coauthors ?? 0,
      url: v.codigoMateria
        ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${v.codigoMateria}`
        : 'https://www25.senado.leg.br/web/atividade/votacoes-nominais',
      // Votação secreta: o Senado não publica o voto individual.
      ballots:
        v.votacaoSecreta === 'S'
          ? []
          : (v.votos ?? []).map((b) => ({
              name: b.nomeParlamentar,
              party: b.siglaPartidoParlamentar ?? '',
              uf: b.siglaUFParlamentar ?? '',
              vote: b.siglaVotoParlamentar ?? '—',
            })),
    };
  });
}

/**
 * Últimas votações de plenário das duas casas, mais recente primeiro.
 * Uma casa fora do ar não esconde a outra.
 */
export async function listVotes(): Promise<{ votes: Vote[]; stale: boolean; failed: House[] }> {
  const failed: House[] = [];
  const pick = async (house: House, fn: () => Promise<Vote[]>) => {
    try {
      const { data, stale } = await cached(`votes:v2:${house}`, fn, 3 * HOUR, 7 * DAY);
      return { list: data ?? [], stale };
    } catch {
      failed.push(house);
      return { list: [] as Vote[], stale: false };
    }
  };
  const [c, s] = await Promise.all([pick('camara', camaraVotes), pick('senado', senadoVotes)]);
  const votes = groupVotes([...c.list, ...s.list])
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 25);
  return { votes, stale: c.stale || s.stale, failed };
}

/**
 * Junta votações da mesma proposição no mesmo dia e casa. Sem isso a lista
 * mostra "PLP 74/2026" três vezes (texto, emenda, redação final), parecendo
 * duplicada.
 */
function groupVotes(list: Vote[]): Vote[] {
  const groups = new Map<string, Vote>();
  for (const v of list) {
    const key = `${v.house}|${v.date}|${v.label ?? v.text}`;
    const step: VoteStep = { id: v.id, detail: v.detail, ballots: v.ballots };
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { ...v, steps: [step] });
      continue;
    }
    g.steps!.push(step);
    // A linha mostra a decisão com registro nominal, se houver.
    if (!g.ballots?.length && v.ballots?.length) g.ballots = v.ballots;
  }
  return [...groups.values()].map((g) => ({
    ...g,
    detail:
      g.steps!.length > 1
        ? `${g.steps!.length} votações nesta sessão. Toque para ver cada uma.`
        : g.detail,
  }));
}

/** Uma votação da lista (já em cache), pelo id usado na tela. */
export async function getVote(id: string): Promise<Vote | null> {
  const { votes } = await listVotes();
  return votes.find((v) => v.id === id) ?? null;
}

/**
 * Como cada parlamentar votou. No Senado vem junto da votação; na Câmara é
 * outra consulta. Lista vazia quer dizer votação simbólica ou secreta.
 */
export async function listBallots(vote: Vote, stepId?: string): Promise<Ballot[]> {
  const step = vote.steps?.find((s) => s.id === stepId);
  if (vote.house === 'senado') return (step ?? vote).ballots ?? [];
  const id = (stepId ?? vote.id).replace(/^camara-/, '');
  const { data } = await cached(
    `ballots:camara:${id}`,
    async () => {
      const { dados } = await getJson<{
        dados: { tipoVoto: string; deputado_: { nome: string; siglaPartido: string; siglaUf: string } }[];
      }>(`${CAMARA}/votacoes/${id}/votos`);
      return dados.map<Ballot>((b) => ({
        name: b.deputado_.nome,
        party: b.deputado_.siglaPartido,
        uf: b.deputado_.siglaUf,
        vote: b.tipoVoto,
      }));
    },
    7 * DAY,
    30 * DAY,
  );
  return data ?? [];
}
