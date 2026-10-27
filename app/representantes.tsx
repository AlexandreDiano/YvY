import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { CARGO_ORDER, listElected, type Elected } from '@/api/elected';
import { useRouter } from 'expo-router';
import {
  ASSEMBLEIA,
  DEPUTY_SALARY,
  UFS,
  cityGazettes,
  deputyPresence,
  listBills,
  listDeputies,
  listPresidentialMeasures,
  listSenators,
  type Bill,
  type BillOutcome,
  type BillScope,
  type CityGazettes,
  type Official,
  type Presence,
} from '@/api/officials';
import { useAuth } from '@/features/auth/AuthProvider';
import { brDate, electionOver } from '@/lib/format';
import { Badge, Button, Card, Chip, Field, Loading, Row, Screen, Section, Txt, color, space } from '@/ui';

/**
 * Quem foi eleito e o que está fazendo, do país até a cidade da pessoa.
 *
 * UF e cidade vêm do perfil (do CEP do cadastro) e só servem para montar as
 * consultas aqui no aparelho. O que a pessoa consulta não vai para o nosso
 * servidor. Sem perfil, ela escolhe a UF.
 *
 * Ordem e conteúdo são os das fontes oficiais: todo parlamentar da UF aparece,
 * em ordem alfabética, sem destaque.
 */
export default function Representantes() {
  const { profile } = useAuth();
  const [picked, setPicked] = useState<string | null>(null);
  const [scope, setScope] = useState<'uf' | 'br'>('uf');
  const [view, setView] = useState<'now' | 'elected'>('now');
  const uf = profile?.state ?? picked;
  const city = profile?.state ? profile.city : null;

  return (
    <Screen>
      <Row style={{ flexWrap: 'wrap' }}>
        <Chip label="No cargo agora" active={view === 'now'} onPress={() => setView('now')} />
        <Chip label="Eleitos em 2026" active={view === 'elected'} onPress={() => setView('elected')} />
      </Row>
      <Row style={{ flexWrap: 'wrap' }}>
        <Chip
          label={uf ? `Minha região (${uf})` : 'Minha região'}
          active={scope === 'uf'}
          onPress={() => setScope('uf')}
        />
        <Chip label="Brasil todo" active={scope === 'br'} onPress={() => setScope('br')} />
      </Row>
      <Txt variant="small" muted>
        {view === 'now'
          ? 'Quem está no cargo hoje. Em cada um, veja o que fez neste mandato ou na carreira toda.'
          : electionOver()
            ? 'Eleitos em 2026. Tomam posse em 2027. Fonte: TSE.'
            : 'Eleitos no 1º turno de 2026 e quem disputa o 2º turno (25/10). Tomam posse em 2027. Fonte: TSE.'}
      </Txt>

      {scope === 'br' ? null : profile?.state ? (
        <Txt variant="small" muted>
          {city ? `${city} · ${uf}` : uf} — pelo CEP do seu cadastro.
        </Txt>
      ) : (
        <>
          <Txt variant="small" muted>
            Escolha o estado:
          </Txt>
          <Row style={{ flexWrap: 'wrap' }}>
            {UFS.map((u) => (
              <Chip key={u} label={u} active={u === picked} onPress={() => setPicked(u)} />
            ))}
          </Row>
        </>
      )}

      {view === 'elected' ? (
        <ElectedSections key={`${scope}-${uf}`} uf={scope === 'uf' ? uf : null} />
      ) : (
        <>
          <Section title="Presidência da República" />
          <Txt variant="small" muted>
            Medidas provisórias editadas pela Presidência neste mandato (desde 2023). Valem como lei por até 120
            dias, até o Congresso votar.
          </Txt>
          <BillList load={listPresidentialMeasures} />

          {scope === 'br' ? <NationalSections /> : uf ? <UfSections key={uf} uf={uf} city={city} /> : null}
        </>
      )}

      <Txt variant="small" muted>
        Fontes: Dados Abertos da Câmara dos Deputados e do Senado Federal; TSE (eleitos 2026); Querido Diário
        (Open Knowledge Brasil). Texto reproduzido como publicado.
      </Txt>
    </Screen>
  );
}

function UfSections({ uf, city }: { uf: string; city: string | null }) {
  const [senators, setSenators] = useState<Official[] | null>(null);
  const [deputies, setDeputies] = useState<Official[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    listSenators(uf).then(setSenators, () => setError(true));
    listDeputies(uf).then(setDeputies, () => setError(true));
  }, [uf]);

  return (
    <>
      {error ? (
        <Txt variant="small" tone="danger">
          Não foi possível falar com a fonte oficial. Tente de novo em instantes.
        </Txt>
      ) : null}

      <Section title={`Senadores · ${uf}`} />
      {senators ? senators.map((o) => <OfficialCard key={o.id} official={o} />) : error ? null : <Loading />}

      <Section title={`Deputados federais · ${uf}`} />
      {deputies ? deputies.map((o) => <OfficialCard key={o.id} official={o} />) : error ? null : <Loading />}

      <Section title={`Governo e Assembleia · ${uf}`} />
      <Card>
        <Txt variant="body">
          Os estados não têm dados abertos num formato comum. Os projetos dos deputados estaduais e os
          enviados pelo governador tramitam na Assembleia Legislativa.
        </Txt>
        {ASSEMBLEIA[uf] ? (
          <Button
            title="Abrir site da Assembleia"
            kind="outline"
            small
            onPress={() => void Linking.openURL(ASSEMBLEIA[uf]!)}
          />
        ) : null}
      </Card>

      {city ? <CitySection city={city} uf={uf} /> : null}
    </>
  );
}

/**
 * Brasil todo dá 81 senadores e 513 deputados, comprido demais para rolar.
 * Então é busca por nome, partido ou UF, no máximo 30 por vez.
 */
function NationalSections() {
  const [all, setAll] = useState<Official[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    Promise.all([listSenators(null), listDeputies(null)]).then(
      ([sen, dep]) => setAll([...sen, ...dep]),
      () => setError(true),
    );
  }, []);

  if (error) {
    return (
      <Txt variant="small" tone="danger">
        Não foi possível falar com a fonte oficial. Tente de novo em instantes.
      </Txt>
    );
  }
  if (!all) return <Loading />;

  const term = fold(q);
  const hits = term
    ? all.filter((o) => fold(`${o.name} ${o.party} ${o.uf}`).includes(term))
    : all;
  return (
    <>
      <Section title="Senadores e deputados federais" />
      <Field
        label="Buscar"
        value={q}
        onChangeText={setQ}
        placeholder="Nome, partido ou UF (ex.: PT, SP, Maria)"
      />
      <Txt variant="small" muted>
        {hits.length} {hits.length === 1 ? 'resultado' : 'resultados'}
        {hits.length > 30 ? ' — mostrando 30, refine a busca' : ''}
      </Txt>
      {hits.slice(0, 30).map((o) => (
        <OfficialCard key={`${o.house}-${o.id}`} official={o} />
      ))}
    </>
  );
}

/**
 * Eleitos em 2026, pelo TSE. Quem já está no Congresso (reeleito ou trocando
 * de casa) é ligado ao cadastro da Câmara/Senado por nome e UF, e aí dá para
 * ver o que já fez. Quem nunca teve mandato federal não tem histórico nessas
 * bases, e a tela fala isso.
 */
function ElectedSections({ uf }: { uf: string | null }) {
  const [list, setList] = useState<Elected[] | null>(null);
  const [current, setCurrent] = useState<Official[]>([]);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    listElected(uf).then(setList, () => setError(true));
    Promise.all([listSenators(null), listDeputies(null)]).then(
      ([s, d]) => setCurrent([...s, ...d]),
      () => setCurrent([]),
    );
  }, [uf]);

  if (error) {
    return (
      <Txt variant="small" tone="danger">
        Não foi possível carregar os eleitos agora.
      </Txt>
    );
  }
  if (!list) return <Loading />;
  if (!list.length) {
    return (
      <Txt variant="small" muted>
        Lista de eleitos indisponível neste modo.
      </Txt>
    );
  }

  const byName = new Map(current.map((o) => [`${fold(o.name)}|${o.uf}`, o]));
  const byNameAnyUf = new Map(current.map((o) => [fold(o.name), o]));
  // presidente concorre pelo Brasil (UF "BR"), casa só pelo nome
  const match = (e: Elected) =>
    byName.get(`${fold(e.nome_urna)}|${e.uf}`) ?? (e.uf === 'BR' ? byNameAnyUf.get(fold(e.nome_urna)) : null) ?? null;
  const term = fold(q);
  const hits = term ? list.filter((e) => fold(`${e.nome_urna} ${e.nome} ${e.partido} ${e.uf}`).includes(term)) : list;

  return (
    <>
      {uf ? null : (
        <Field label="Buscar" value={q} onChangeText={setQ} placeholder="Nome, partido ou UF" />
      )}
      {CARGO_ORDER.map((cargo) => {
        const group = hits.filter((e) => e.cargo === cargo);
        if (!group.length) return null;
        const shown = uf ? group : group.slice(0, 30);
        return (
          <View key={cargo} style={{ gap: space.md }}>
            <Section title={`${cargo}${uf && cargo !== 'Presidente' ? ` · ${uf}` : ''} · ${group.length}`} />
            {shown.map((e) => (
              <ElectedCard key={e.sq_candidato} e={e} official={match(e)} />
            ))}
            {shown.length < group.length ? (
              <Txt variant="small" muted>
                Mostrando 30 de {group.length}. Refine a busca.
              </Txt>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

function ElectedCard({ e, official }: { e: Elected; official: Official | null }) {
  const status =
    e.situacao !== '2º TURNO' ? 'Eleito(a)' : electionOver() ? 'Foi ao 2º turno (resultado em atualização)' : 'Disputa o 2º turno';
  const executive = e.cargo === 'Presidente' || e.cargo === 'Governador';
  if (executive) return <ExecutiveCard e={e} status={status} official={official} />;
  if (official) {
    const sameRole =
      (e.cargo === 'Senador' && official.house === 'senado') ||
      (e.cargo === 'Deputado Federal' && official.house === 'camara');
    const now = official.house === 'senado' ? 'senador(a)' : 'deputado(a) federal';
    return (
      <OfficialCard
        official={official}
        note={
          `${status} ${e.cargo.toLowerCase()} em 2026 · ${e.votos.toLocaleString('pt-BR')} votos` +
          (sameRole ? '' : `. Hoje é ${now}: as proposições abaixo são desse cargo, não do novo.`)
        }
      />
    );
  }
  const federal = e.cargo === 'Senador' || e.cargo === 'Deputado Federal';
  return (
    <Card>
      <Txt variant="heading">{e.nome_urna}</Txt>
      <Txt variant="small" muted>
        {e.cargo} · {e.partido} · {e.uf === 'BR' ? 'Brasil' : e.uf}
      </Txt>
      <Txt variant="small">
        {status} · {e.votos.toLocaleString('pt-BR')} votos
      </Txt>
      <Txt variant="small" muted>
        {federal
          ? 'Não está no Congresso hoje: sem histórico nas bases da Câmara e do Senado.'
          : e.cargo === 'Deputado Estadual' || e.cargo === 'Deputado Distrital'
            ? 'Projetos de deputado estadual ficam no site da Assembleia Legislativa.'
            : 'Atos de governo ficam no diário oficial do estado.'}
      </Txt>
    </Card>
  );
}

/**
 * Presidente e governador não apresentam projeto de lei como parlamentar.
 * Mostra o plano de governo do TSE e, se já tiveram cargo no Congresso, o
 * que fizeram lá.
 */
function ExecutiveCard({ e, status, official }: { e: Elected; status: string; official: Official | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<'plano' | 'atuacao'>('plano');
  return (
    <Card>
      <Txt variant="heading">{e.nome_urna}</Txt>
      <Txt variant="small" muted>
        {e.cargo} · {e.partido} · {e.uf === 'BR' ? 'Brasil' : e.uf}
      </Txt>
      <Txt variant="small">
        {status} · {e.votos.toLocaleString('pt-BR')} votos
      </Txt>
      <Row style={{ flexWrap: 'wrap' }}>
        <Chip label="Plano de governo" active={tab === 'plano'} onPress={() => setTab('plano')} />
        <Chip label="Atuação até aqui" active={tab === 'atuacao'} onPress={() => setTab('atuacao')} />
      </Row>
      {tab === 'plano' ? (
        <>
          <Txt variant="small" muted>
            Propostas copiadas do plano registrado no TSE, com página, e o PDF completo.
          </Txt>
          <Button
            title="Ver plano de governo"
            kind="outline"
            small
            onPress={() => router.push(`/plano/${e.sq_candidato}`)}
          />
        </>
      ) : official ? (
        <OfficialCard official={official} note="Cargo atual no Congresso." />
      ) : (
        <Txt variant="small" muted>
          {e.cargo === 'Presidente'
            ? 'Atos da Presidência atual (medidas provisórias) estão na aba "No cargo agora". Sem mandato no Congresso hoje para mostrar projetos.'
            : 'Atos de governo estadual saem no diário oficial do estado, que não tem dados abertos num formato comum.'}
        </Txt>
      )}
    </Card>
  );
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function CitySection({ city, uf }: { city: string; uf: string }) {
  // undefined = carregando; null = cidade não encontrada no Querido Diário
  const [data, setData] = useState<CityGazettes | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    cityGazettes(city, uf).then(
      (r) => setData(r.data),
      () => setError(true),
    );
  }, [city, uf]);

  return (
    <>
      <Section title={`Prefeitura · ${city}`} />
      {error ? (
        <Txt variant="small" tone="danger">
          O Querido Diário não respondeu agora. Tente de novo mais tarde.
        </Txt>
      ) : data === undefined ? (
        <Loading />
      ) : (
        <Card>
          <Txt variant="body">
            Decretos, nomeações e contratos da prefeitura saem no diário oficial do município. Projetos dos
            vereadores ficam no site da Câmara Municipal.
          </Txt>
          {data?.gazettes.length ? (
            <View style={{ gap: space.xs }}>
              <Txt variant="label" muted upper>
                Edições recentes
              </Txt>
              {data.gazettes.map((g) => (
                <Txt
                  key={g.url}
                  variant="small"
                  tone="primary"
                  onPress={() => void Linking.openURL(g.url)}
                >
                  {brDate(g.date)}
                  {g.edition ? ` · edição ${g.edition}` : ''}
                  {g.extra ? ' (extra)' : ''} ›
                </Txt>
              ))}
            </View>
          ) : (
            <Txt variant="small" muted>
              O Querido Diário ainda não indexa o diário desta cidade.
            </Txt>
          )}
          {data?.officialUrl ? (
            <Button
              title="Abrir diário oficial"
              kind="outline"
              small
              onPress={() => void Linking.openURL(data.officialUrl!)}
            />
          ) : null}
        </Card>
      )}
    </>
  );
}

function OfficialCard({ official, note }: { official: Official; note?: string }) {
  const [open, setOpen] = useState(false);
  const [billScope, setBillScope] = useState<BillScope>('mandate');

  return (
    <Card>
      <Txt variant="heading">{official.name}</Txt>
      <Txt variant="small" muted>
        {official.house === 'senado' ? 'Senador(a)' : 'Deputado(a) federal'} ·{' '}
        {official.party ? `${official.party} · ` : ''}
        {official.uf}
      </Txt>
      {note ? <Txt variant="small">{note}</Txt> : null}
      <Row>
        <Button
          title={open ? 'Fechar' : 'Proposições'}
          small
          block={false}
          kind={open ? 'ghost' : 'primary'}
          onPress={() => setOpen((v) => !v)}
        />
        <Button
          title="Página oficial"
          small
          block={false}
          kind="ghost"
          onPress={() => void Linking.openURL(official.url)}
        />
      </Row>
      {open ? (
        <>
          {official.house === 'camara' ? <DeputyFacts id={official.id} /> : <SenatorFacts />}
          <Txt variant="label" muted upper>
            Proposições como {official.house === 'senado' ? 'senador(a)' : 'deputado(a) federal'}
          </Txt>
          <Row>
            <Chip label="Este mandato" active={billScope === 'mandate'} onPress={() => setBillScope('mandate')} />
            <Chip label="Carreira toda" active={billScope === 'career'} onPress={() => setBillScope('career')} />
          </Row>
          <BillList key={billScope} load={() => listBills(official, billScope)} />
        </>
      ) : null}
    </Card>
  );
}

/** Presença no Plenário e salário (deputado federal), dados da Câmara. */
function DeputyFacts({ id }: { id: string }) {
  const [presence, setPresence] = useState<Presence | null | undefined>(undefined);

  useEffect(() => {
    deputyPresence(id).then(setPresence, () => setPresence(null));
  }, [id]);

  const pct = presence && presence.total ? Math.round((presence.present / presence.total) * 100) : null;
  return (
    <View style={{ gap: space.xs }}>
      {presence === undefined ? (
        <Txt variant="small" muted>
          Calculando presença no Plenário...
        </Txt>
      ) : presence && pct !== null ? (
        <Txt variant="small">
          Presença no Plenário: {presence.present} de {presence.total} sessões deliberativas ({pct}%) desde{' '}
          {brDate(presence.since)}.
        </Txt>
      ) : (
        <Txt variant="small" muted>
          Presença no Plenário indisponível agora.
        </Txt>
      )}
      <Txt variant="small">
        Salário bruto: R$ {DEPUTY_SALARY.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por mês (igual para
        todos os deputados).
      </Txt>
      <Txt variant="small" muted>
        Presença conta só o Plenário; a API não separa falta justificada. Gastos de gabinete e cota estão na
        página oficial.
      </Txt>
    </View>
  );
}

function SenatorFacts() {
  return (
    <Txt variant="small" muted>
      Presença, salário e gastos de senador estão na página oficial do Senado (a API pública não traz
      presença por sessão de forma direta).
    </Txt>
  );
}

const OUTCOME_COLOR = {
  approved: color.success,
  rejected: color.danger,
  archived: color.neutral,
  pending: color.warning,
} as const;

/** "Aprovado - 26/07/2017". Em tramitação só mostra data se mudou desde a apresentação. */
function OutcomeTag({ outcome, created }: { outcome: BillOutcome; created: string }) {
  const showDate = outcome.date && (outcome.kind !== 'pending' || outcome.date !== created);
  return (
    <Row>
      <Badge
        label={`${outcome.label}${showDate ? ` - ${brDate(outcome.date!)}` : ''}`}
        color={OUTCOME_COLOR[outcome.kind]}
      />
    </Row>
  );
}

function BillList({ load }: { load: () => Promise<{ bills: Bill[]; total?: number; stale: boolean }> }) {
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    load().then(
      (r) => {
        setBills(r.bills);
        setTotal(r.total ?? null);
      },
      () => setError(true),
    );
    // `load` muda a cada render do pai; buscar uma vez por montagem basta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <Txt variant="small" tone="danger">
        A fonte oficial não respondeu. Tente de novo em instantes.
      </Txt>
    );
  }
  if (!bills) return <Loading />;
  if (bills.length === 0) {
    return (
      <Txt variant="small" muted>
        Nenhuma proposição encontrada.
      </Txt>
    );
  }
  return (
    <View style={{ gap: space.sm }}>
      {total !== null ? (
        <Txt variant="small" muted>
          {total} {total === 1 ? 'proposição' : 'proposições'} (projetos de lei e PECs) como autor ou coautor
          {total > bills.length ? ` — mostrando as ${bills.length} mais recentes` : ''}.
        </Txt>
      ) : null}
      {bills.map((b) => (
        <Card key={b.id} onPress={() => void Linking.openURL(b.url)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="heading">{b.label}</Txt>
            <Txt variant="small" muted>
              {brDate(b.date)}
            </Txt>
          </Row>
          <Txt variant="body" numberOfLines={4}>
            {b.text}
          </Txt>
          {b.outcome ? <OutcomeTag outcome={b.outcome} created={b.date} /> : null}
          {b.status ? (
            <Txt variant="small" muted>
              {b.status}
            </Txt>
          ) : null}
        </Card>
      ))}
    </View>
  );
}
