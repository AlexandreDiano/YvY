import { DAY, HOUR, MANDATE, cached, getJson } from '@/api/officials/shared';

// ------------------------------------------------------------ estado e cidade

/**
 * Assembleias legislativas. As 27 não têm API em comum, então o app só aponta
 * o site oficial. Conferidas em 11/10/2026: AP, MG, PB e RR não responderam do
 * ambiente de teste (provavelmente bloqueio ou instabilidade), mas os domínios
 * ficaram porque são os oficiais. Conferir de novo antes do lançamento.
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
/** O Querido Diário é projeto da sociedade civil e demora para responder (10 a 30 s). */
const QD_TIMEOUT = 40000;

export type Gazette = { date: string; edition: string | null; extra: boolean; url: string };

export type CityGazettes = {
  city: string;
  /** Site oficial onde a prefeitura publica o diário. */
  officialUrl: string | null;
  /** Edições recentes indexadas pelo Querido Diário. Vazio quer dizer cidade sem cobertura. */
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
 * Diário oficial do município, onde saem decretos, nomeações e contratos da
 * prefeitura. Vem do Querido Diário (Open Knowledge Brasil), que cobre parte
 * dos 5.570 municípios. Para os outros devolve só o link oficial do diário.
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
