// Pauta do plenário da Câmara e do Senado (DIANO-136). Só `fetch`, sem Deno:
// roda na Edge Function e no script de simulação.
//
// Câmara: sessões deliberativas do Plenário (órgão 180, tipo 110) e a pauta
// de cada uma. Senado: agenda do mês do Plenário, que traz também sessão do
// Congresso Nacional (Casa = CN).

import { alertable, type Item } from './match.ts';

const CAMARA = 'https://dadosabertos.camara.leg.br/api/v2';
const SENADO = 'https://legis.senado.leg.br/dadosabertos';

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} respondeu ${res.status}`);
  return res.json();
}

const asList = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

type CamaraProp = { id: number; siglaTipo: string; numero: number | string; ano: number | string; ementa: string };
type CamaraPauta = { proposicao_?: CamaraProp | null; proposicaoRelacionada_?: CamaraProp | null };

/** `from`/`to` em AAAA-MM-DD. `done` inclui sessão encerrada (simulação). */
export async function camara(from: string, to: string, done = false): Promise<Item[]> {
  const ev = (await getJson(
    `${CAMARA}/eventos?idOrgao=180&codTipoEvento=110&dataInicio=${from}&dataFim=${to}&itens=100`,
  )) as { dados: { id: number; dataHoraInicio: string; situacao: string }[] };
  const sessions = ev.dados.filter((e) => done || !/encerrad|cancelad/i.test(e.situacao));
  const out: Item[] = [];
  for (const s of sessions) {
    const pauta = (await getJson(`${CAMARA}/eventos/${s.id}/pauta`)) as { dados: CamaraPauta[] };
    for (const p of pauta.dados) {
      let prop = p.proposicao_ ?? null;
      let urgencia = false;
      // requerimento de urgência: o que interessa é a proposição a que ele se refere
      if (prop && prop.siglaTipo === 'REQ' && p.proposicaoRelacionada_ && /urg[eê]ncia/i.test(prop.ementa)) {
        prop = p.proposicaoRelacionada_;
        urgencia = true;
      }
      if (!prop || !alertable({ sigla: prop.siglaTipo })) continue;
      out.push({
        casa: 'camara',
        propId: String(prop.id),
        sigla: prop.siglaTipo,
        numero: String(prop.numero),
        ano: String(prop.ano),
        ementa: prop.ementa ?? '',
        urgencia,
        sessionAt: `${s.dataHoraInicio}:00-03:00`,
        url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${prop.id}`,
        // toda proposição da Câmara tem enquete com o mesmo id
        voteUrl: `https://www.camara.leg.br/enquetes/${prop.id}`,
      });
    }
  }
  return out;
}

type SenadoMateria = {
  CodigoMateria: string;
  SiglaMateria: string;
  NumeroMateria: string;
  AnoMateria: string;
  Ementa?: string;
};
type SenadoSessao = {
  Data: string;
  Hora: string;
  Casa: string;
  TipoSessao: string;
  SituacaoSessao: string;
  Materias?: { Materia?: SenadoMateria | SenadoMateria[] };
};

function months(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from.slice(0, 7)}-01T12:00:00Z`);
  const end = to.slice(0, 7);
  while (d.toISOString().slice(0, 7) <= end) {
    out.push(d.toISOString().slice(0, 7).replace('-', ''));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

export async function senado(from: string, to: string, done = false): Promise<Item[]> {
  const out: Item[] = [];
  // a janela pode cruzar o fim do mês: um arquivo por mês
  for (const ym of months(from, to)) {
    const data = (await getJson(`${SENADO}/plenario/agenda/mes/${ym}01.json`)) as {
      AgendaPlenario?: { Sessoes?: { Sessao?: SenadoSessao | SenadoSessao[] } };
    };
    for (const s of asList(data.AgendaPlenario?.Sessoes?.Sessao)) {
      if (s.Data < from || s.Data > to) continue;
      if (!/DELIBERATIVA/i.test(s.TipoSessao) || /N[ÃA]O DELIBERATIVA/i.test(s.TipoSessao)) continue;
      if (!done && /encerrad|n[ãa]o realizad|cancelad/i.test(s.SituacaoSessao)) continue;
      for (const m of asList(s.Materias?.Materia)) {
        if (!alertable({ sigla: m.SiglaMateria })) continue;
        out.push({
          casa: s.Casa === 'CN' ? 'congresso' : 'senado',
          propId: m.CodigoMateria,
          sigla: m.SiglaMateria,
          numero: m.NumeroMateria,
          ano: m.AnoMateria,
          ementa: m.Ementa ?? '',
          urgencia: false,
          sessionAt: `${s.Data}T${s.Hora || '00:00'}:00-03:00`,
          // a ficha do Senado abre também matéria do Congresso (mesmo código)
          url: `https://www25.senado.leg.br/web/atividade/materias/-/materia/${m.CodigoMateria}`,
          // toda matéria do Senado tem consulta no e-Cidadania com o mesmo código
          voteUrl:
            s.Casa === 'CN' ? null : `https://www12.senado.leg.br/ecidadania/visualizacaomateria?id=${m.CodigoMateria}`,
        });
      }
    }
  }
  return out;
}
