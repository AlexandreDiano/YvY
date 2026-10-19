import { CAMARA, DAY, MANDATE, type Official, SENADO, asList, cached, getJson, https, isoDay } from '@/api/officials/shared';

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
 * Presença no Plenário neste mandato: sessões deliberativas com presença
 * registrada dividido pelas sessões realizadas. Conta só a partir do primeiro
 * registro do deputado, para suplente que assumiu depois não ser cobrado pelo
 * tempo em que não era deputado. A API não separa falta justificada.
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
