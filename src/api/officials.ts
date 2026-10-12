import { readCache, withCache } from '@/lib/cache';

/**
 * Transparência: o que quem foi eleito está votando e propondo.
 *
 * Fonte única: APIs oficiais de dados abertos da Câmara e do Senado, chamadas
 * direto do aparelho (CORS liberado nas duas). Não passa pelo Supabase, então
 * modo local e modo Supabase usam o mesmo caminho — não há "segundo caminho"
 * para manter aqui.
 *
 * Regra editorial: o app só repete campos da API — identificação,
 * ementa, data, situação, placar — e aponta o link oficial. Nada de resumo,
 * adjetivo ou seleção de "destaques"; a ordem é sempre por data.
 *
 * Cache: são atos públicos de agentes públicos no exercício do mandato, não
 * dado pessoal de cidadão. Por isso podem ir para o cache de disco
 * (src/lib/cache.ts) — diferente de eleitor. Nada além de nome parlamentar,
 * partido e UF é guardado sobre a pessoa.
 */

const CAMARA = 'https://dadosabertos.camara.leg.br/api/v2';
const SENADO = 'https://legis.senado.leg.br/dadosabertos';
const HOUR = 1000 * 60 * 60;
const DAY = 24 * HOUR;

/**
 * Cache primeiro: dentro de `freshMs` nem vai à rede — cada abertura da tela
 * de votações custaria ~45 requisições em 3G. Depois disso, rede com o cache
 * como reserva quando ela cai.
 */
async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  freshMs: number,
  maxAgeMs: number,
): Promise<{ data: T | null; stale: boolean }> {
  const fresh = await readCache<T>(key, freshMs);
  if (fresh !== null) return { data: fresh, stale: false };
  return withCache(key, fetcher, maxAgeMs);
}

/**
 * Só o mandato vigente: quem não está mais no cargo não aparece, e o que
 * aparece é do mandato atual.
 *   Congresso (legislatura 57, eleitos em 2022)   2023-02-01 → 2027-01-31
 *   Presidente e governador (eleitos em 2022)     2023-01-01 → 2026-12-31
 *   Prefeito e vereador (eleitos em 2024)         2025-01-01 → 2028-12-31
 * Senador eleito em 2018 está no 2º tempo do mandato (2019–2027): mostramos
 * o que fez nesta legislatura, a mesma janela dos deputados.
 * Trocar estas datas quando os eleitos de 2026 tomarem posse.
 */
export const MANDATE = {
  congress: '2023-02-01',
  executive: '2023-01-01',
  municipal: '2025-01-01',
} as const;

/** Tipos que viram lei ou mudam a Constituição. Requerimento fica de fora: é ruído. */
const BILL_TYPES = ['PL', 'PLP', 'PEC', 'PDL'];

export type House = 'camara' | 'senado';

export type Vote = {
  id: string;
  house: House;
  date: string; // YYYY-MM-DD
  /** "PLP 74/2026", quando a API informa a proposição. */
  label: string | null;
  /** Ementa da proposição ou, sem ela, a descrição da votação. Texto da API. */
  text: string;
  /** Descrição da votação (o que foi decidido), quando diferente do texto. */
  detail: string | null;
  /** Primeiro autor da proposição votada: "Nome (PARTIDO/UF)" ou o órgão. */
  author: string | null;
  /** Quantos outros assinam junto. */
  coauthors: number;
  url: string;
  /**
   * Voto de cada parlamentar. Senado: já vem na lista. Câmara: buscado ao
   * abrir a votação (listBallots). Votação simbólica não tem registro.
   */
  ballots?: Ballot[];
  /**
   * Decisões do mesmo dia sobre a mesma proposição (texto principal, emendas,
   * redação final...). A lista mostra uma linha por proposição; a tela da
   * votação mostra cada decisão.
   */
  steps?: VoteStep[];
};

export type VoteStep = { id: string; detail: string | null; ballots?: Ballot[] };

export type Ballot = { name: string; party: string; uf: string; vote: string };

export type Official = {
  id: string;
  house: House;
  name: string;
  party: string;
  uf: string;
  url: string;
};

export type Bill = {
  id: string;
  label: string;
  text: string;
  date: string;
  status: string | null;
  url: string;
  /** Situação resumida + data da situação ("Aprovado", "2017-07-26"). */
  outcome?: BillOutcome | null;
};

export type BillOutcome = { kind: 'approved' | 'rejected' | 'archived' | 'pending'; label: string; date: string | null };

/**
 * Traduz a situação oficial em 4 grupos. O texto oficial continua em
 * `status`; isto é só a etiqueta. Sem certeza, fica "Em tramitação".
 */
export function classifyStatus(raw: string | null | undefined, norma?: string | null): BillOutcome['kind'] {
  const t = (raw ?? '').toUpperCase();
  if (norma || /TRANSFORMAD[OA] EM NORMA|SANCIONAD|PROMULGAD|APROVAD[OA]$|^APROVAD[OA]/.test(t)) return 'approved';
  if (/REJEITAD|VETAD[OA] TOTAL/.test(t)) return 'rejected';
  if (/ARQUIVAD|PREJUDICAD|RETIRAD|TRAMITAÇÃO ENCERRADA|DEVOLVID/.test(t)) return 'archived';
  return 'pending';
}

const OUTCOME_LABEL: Record<BillOutcome['kind'], string> = {
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  archived: 'Arquivado/encerrado',
  pending: 'Em tramitação',
};

export function outcomeOf(raw: string | null | undefined, date: string | null | undefined, norma?: string | null): BillOutcome {
  const kind = classifyStatus(raw, norma);
  return { kind, label: OUTCOME_LABEL[kind], date: date ? date.slice(0, 10) : null };
}

type CamaraStatus = { dados: { statusProposicao: { dataHora: string | null; descricaoSituacao: string | null } } };

/** Situação atual de cada projeto da Câmara (uma consulta por projeto, em paralelo, com cache). */
async function withCamaraOutcomes(bills: Bill[]): Promise<Bill[]> {
  const res = await Promise.allSettled(
    bills.map((b) => getJson<CamaraStatus>(`${CAMARA}/proposicoes/${b.id}`)),
  );
  return bills.map((b, i) => {
    const r = res[i];
    if (r?.status !== 'fulfilled') return b;
    const st = r.value.dados.statusProposicao;
    return { ...b, status: st.descricaoSituacao, outcome: outcomeOf(st.descricaoSituacao, st.dataHora) };
  });
}

async function getJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Fonte oficial respondeu ${res.status}.`);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('A fonte oficial demorou para responder. Tente de novo.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** A API do Senado devolve objeto quando há um item só e array quando há vários. */
function asList<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** URLs do Senado vêm em http://; Android e PWA bloqueiam. */
function https(url: string): string {
  return url.replace(/^http:\/\//, 'https://');
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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
  // A lista não diz qual proposição foi votada ("Aprovada a Redação Final."):
  // o detalhe diz. Só para estas 15, em paralelo; falha num não derruba os outros.
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
      // Ficha da proposição lista as votações dela; sem proposição, a sessão.
      url: prop
        ? `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${prop.id}`
        : eventId
        ? `https://www.camara.leg.br/evento-legislativo/${eventId}`
        : 'https://www.camara.leg.br/busca-portal/proposicoes/pesquisa-simplificada',
    };
  });
}

/**
 * Primeiro signatário de cada proposição. A lista de autores não vem
 * ordenada: ordena por `ordemAssinatura`. Partido e UF são os ATUAIS do
 * deputado (a API não guarda o da época da autoria).
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
  // Projeto que veio da Câmara tem como autor formal "Câmara dos Deputados".
  // Quem propôs de fato está na Câmara: busca lá pela mesma sigla/número/ano.
  // Só vale de 2019 em diante, quando as duas casas passaram a usar numeração
  // única; antes disso o mesmo número pode ser outro projeto.
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
 * Como cada parlamentar votou. Senado vem junto da votação; Câmara é uma
 * consulta à parte. Lista vazia = votação simbólica ou secreta.
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

// ---------------------------------------------------------- representantes

type CamaraDeputy = { id: number; nome: string; siglaPartido: string; siglaUf: string };

/** Deputados em exercício. `uf` null = Brasil todo (513, ~180 KB). */
export async function listDeputies(uf: string | null): Promise<Official[]> {
  const { data } = await cached(
    `deputies:${uf ?? 'BR'}`,
    async () => {
      const { dados } = await getJson<{ dados: CamaraDeputy[] }>(
        `${CAMARA}/deputados?${uf ? `siglaUf=${uf}&` : ''}ordem=ASC&ordenarPor=nome&itens=600`,
      );
      return dados.map<Official>((d) => ({
        id: String(d.id),
        house: 'camara',
        name: d.nome,
        party: d.siglaPartido,
        uf: d.siglaUf,
        url: `https://www.camara.leg.br/deputados/${d.id}`,
      }));
    },
    DAY,
    7 * DAY,
  );
  return data ?? [];
}

type SenadoParlamentar = {
  IdentificacaoParlamentar: {
    CodigoParlamentar: string;
    NomeParlamentar: string;
    SiglaPartidoParlamentar?: string;
    UfParlamentar: string;
    UrlPaginaParlamentar?: string;
  };
};

/** Senadores em exercício. `uf` null = Brasil todo (81). */
export async function listSenators(uf: string | null): Promise<Official[]> {
  const { data } = await cached(
    `senators:${uf ?? 'BR'}`,
    async () => {
      const json = await getJson<{
        ListaParlamentarEmExercicio: { Parlamentares?: { Parlamentar?: SenadoParlamentar | SenadoParlamentar[] } };
      }>(`${SENADO}/senador/lista/atual.json${uf ? `?uf=${uf}` : ''}`);
      return asList(json.ListaParlamentarEmExercicio.Parlamentares?.Parlamentar)
        .map((p) => p.IdentificacaoParlamentar)
        .filter((p) => !uf || p.UfParlamentar === uf)
        .map<Official>((p) => ({
          id: p.CodigoParlamentar,
          house: 'senado',
          name: p.NomeParlamentar,
          party: p.SiglaPartidoParlamentar ?? '',
          uf: p.UfParlamentar,
          url: https(
            p.UrlPaginaParlamentar ??
              `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${p.CodigoParlamentar}`,
          ),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    DAY,
    7 * DAY,
  );
  return data ?? [];
}

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
      // Sem filtro de data nem de tipo na API (~300 KB tramitando, ~1 MB com
      // a carreira toda). Por isso só busca quando a pessoa toca no senador.
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

/** Salário bruto de deputado federal, como a Câmara publica na página de cada um (conferido em 11/10/2026). */
export const DEPUTY_SALARY = 46366.19;

export type Presence = {
  /** Sessões deliberativas do Plenário com presença registrada. */
  present: number;
  /** Sessões deliberativas do Plenário realizadas no período. */
  total: number;
  since: string;
};

async function allPages<T>(url: string, maxPages = 15): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const { dados } = await getJson<{ dados: T[] }>(`${url}&itens=100&pagina=${page}`);
    out.push(...dados);
    if (dados.length < 100) break;
  }
  return out;
}

type CamaraEvent = { id: number; descricaoTipo: string; situacao: string; orgaos: { sigla: string }[] };
const isPlenarySession = (e: CamaraEvent) =>
  e.descricaoTipo === 'Sessão Deliberativa' && e.situacao === 'Encerrada' && e.orgaos.some((o) => o.sigla === 'PLEN');

/**
 * Presença no Plenário neste mandato: sessões deliberativas em que o
 * deputado registrou presença ÷ sessões deliberativas realizadas. Conta só
 * desde o primeiro registro dele (suplente que assumiu depois não é
 * cobrado pelo período em que não era deputado). Ausência justificada não é
 * separada: a API não informa.
 */
export async function deputyPresence(id: string): Promise<Presence | null> {
  const today = isoDay(new Date());
  const { data } = await cached(
    `presence:v1:${id}`,
    async () => {
      const mine = (
        await allPages<CamaraEvent & { dataHoraInicio: string }>(
          `${CAMARA}/deputados/${id}/eventos?dataInicio=${MANDATE.congress}&dataFim=${today}`,
        )
      ).filter(isPlenarySession);
      if (!mine.length) return null;
      const since = mine.map((e) => e.dataHoraInicio.slice(0, 10)).sort()[0]!;
      const all = (
        await allPages<CamaraEvent>(
          `${CAMARA}/eventos?idOrgao=180&codTipoEvento=110&dataInicio=${since}&dataFim=${today}`,
        )
      ).filter(isPlenarySession);
      const ids = new Set(all.map((e) => e.id));
      return { present: mine.filter((e) => ids.has(e.id)).length, total: all.length, since };
    },
    DAY,
    7 * DAY,
  );
  return data ?? null;
}

/** Medidas provisórias: o ato com força de lei que a Presidência edita sozinha. */
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

// ------------------------------------------------------------ estado e cidade

/**
 * Assembleias legislativas. Não há API comum entre as 27; o app só aponta o
 * site oficial. Conferidas em 11/10/2026 — AP, MG, PB e RR não responderam
 * do ambiente de teste (provável bloqueio/instabilidade), domínios mantidos
 * por serem os oficiais conhecidos. Conferir de novo antes do lançamento.
 */
export const ASSEMBLEIA: Record<string, string> = {
  AC: 'https://www.al.ac.leg.br',
  AL: 'https://www.al.al.leg.br',
  AM: 'https://www.aleam.gov.br',
  AP: 'https://www.al.ap.leg.br',
  BA: 'https://www.al.ba.gov.br',
  CE: 'https://www.al.ce.gov.br',
  DF: 'https://www.cl.df.gov.br',
  ES: 'https://www.al.es.gov.br',
  GO: 'https://portal.al.go.leg.br',
  MA: 'https://www.al.ma.leg.br',
  MG: 'https://www.almg.gov.br',
  MS: 'https://al.ms.gov.br',
  MT: 'https://www.al.mt.gov.br',
  PA: 'https://www.alepa.pa.gov.br',
  PB: 'https://www.al.pb.leg.br',
  PE: 'https://www.alepe.pe.gov.br',
  PI: 'https://www.al.pi.leg.br',
  PR: 'https://www.assembleia.pr.leg.br',
  RJ: 'https://www.alerj.rj.gov.br',
  RN: 'https://www.al.rn.leg.br',
  RO: 'https://www.al.ro.leg.br',
  RR: 'https://www.al.rr.leg.br',
  RS: 'https://ww4.al.rs.gov.br',
  SC: 'https://www.alesc.sc.gov.br',
  SE: 'https://al.se.leg.br',
  SP: 'https://www.al.sp.gov.br',
  TO: 'https://www.al.to.leg.br',
};

export const UFS = Object.keys(ASSEMBLEIA);

const QD = 'https://api.queridodiario.org.br';
/** Querido Diário é projeto da sociedade civil e responde devagar (10–30 s). */
const QD_TIMEOUT = 40000;

export type Gazette = { date: string; edition: string | null; extra: boolean; url: string };

export type CityGazettes = {
  city: string;
  /** Site oficial onde a prefeitura publica o diário. */
  officialUrl: string | null;
  /** Edições recentes indexadas pelo Querido Diário. Vazio = cidade sem cobertura. */
  gazettes: Gazette[];
};

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Diário oficial do município — onde saem decretos, nomeações e contratos da
 * prefeitura. Fonte: Querido Diário (Open Knowledge Brasil), que indexa parte
 * dos 5.570 municípios; para os demais, devolve só o link oficial do diário.
 */
export async function cityGazettes(city: string, uf: string): Promise<{ data: CityGazettes | null; stale: boolean }> {
  return cached(
    `gazettes:${uf}:${fold(city)}`,
    async () => {
      const { cities } = await getJson<{
        cities: { territory_id: string; territory_name: string; state_code: string; publication_urls?: string[] }[];
      }>(`${QD}/cities?city_name=${encodeURIComponent(city)}`, QD_TIMEOUT);
      const match = cities.find((c) => c.state_code === uf && fold(c.territory_name) === fold(city));
      if (!match) return null;
      const { gazettes } = await getJson<{
        gazettes: { date: string; edition: string | null; is_extra_edition: boolean; url: string }[];
      }>(
        `${QD}/gazettes?territory_ids=${match.territory_id}&published_since=${MANDATE.municipal}` +
          `&size=5&sort_by=descending_date`,
        QD_TIMEOUT,
      );
      return {
        city: match.territory_name,
        officialUrl: match.publication_urls?.[0] ?? null,
        gazettes: gazettes.map((g) => ({ date: g.date, edition: g.edition, extra: g.is_extra_edition, url: g.url })),
      };
    },
    6 * HOUR,
    DAY,
  );
}

// ------------------------------------------------------- consultas públicas

const ECIDADANIA = 'https://www12.senado.leg.br/ecidadania';

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
 * Consultas públicas abertas no e-Cidadania (Senado), na ordem da página.
 * O Senado não tem API para isso: o app lê a página pública. Se o layout do
 * site mudar, a lista vem vazia e a tela oferece o link direto.
 * Só no app: o site não libera CORS, então no navegador não dá para ler.
 */
export async function listConsultations(page = 1): Promise<{ list: Consultation[]; stale: boolean }> {
  const { data, stale } = await cached(
    `consultas:v2:${page}`,
    async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        // 100 por página; o e-Cidadania tem dezenas de páginas.
        const res = await fetch(`${ECIDADANIA}/pesquisamateria?p=${page}`, { signal: ctrl.signal });
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
