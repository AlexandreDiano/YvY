import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, StyleSheet, View } from 'react-native';
import {
  ECIDADANIA_URL,
  listConsultations,
  listVotes,
  type Consultation,
  type House,
  type Vote,
} from '@/api/officials';
import { brDate } from '@/lib/format';
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Loading,
  Row,
  Screen,
  SimpleText,
  Txt,
  color,
  radius,
} from '@/ui';

const HOUSE: Record<House, { label: string; color: string }> = {
  camara: { label: 'Câmara', color: color.primary },
  senado: { label: 'Senado', color: color.accent },
};

type Tab = 'consultas' | 'votacoes';

/**
 * Congresso, área pública. Mostra as consultas públicas do Senado
 * (e-Cidadania), onde a pessoa vota no site do Senado com o cadastro dela, e
 * as votações recentes de plenário da Câmara e do Senado. O texto é o que as
 * fontes oficiais publicam, sem resumo nosso.
 */
export default function Congresso() {
  const [tab, setTab] = useState<Tab>('consultas');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            setRefreshKey((k) => k + 1);
            setTimeout(() => setRefreshing(false), 600);
          }}
        />
      }
    >
      <Row>
        <Chip label="Consultas públicas" active={tab === 'consultas'} onPress={() => setTab('consultas')} />
        <Chip label="Votações" active={tab === 'votacoes'} onPress={() => setTab('votacoes')} />
      </Row>
      {tab === 'consultas' ? <Consultations key={refreshKey} /> : <Votes key={refreshKey} />}
    </Screen>
  );
}

function Consultations() {
  const [list, setList] = useState<Consultation[] | null>(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    listConsultations(1).then(
      (r) => {
        setList(r.list);
        setStale(r.stale);
      },
      () => setError(true),
    );
  }, []);

  /** Próxima página do e-Cidadania (100 por vez) sem repetir consulta. */
  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const r = await listConsultations(next);
      setList((cur) => {
        const seen = new Set((cur ?? []).map((c) => c.id));
        return [...(cur ?? []), ...r.list.filter((c) => !seen.has(c.id))];
      });
      setPage(next);
      if (!r.list.length) setMore(false);
    } catch {
      setMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  const openSite = (
    <Button
      title="Abrir consultas no site do Senado"
      kind="outline"
      small
      onPress={() => void Linking.openURL(ECIDADANIA_URL)}
    />
  );

  if (error) {
    return (
      <>
        <Txt variant="small" muted>
          Não foi possível carregar a lista do e-Cidadania agora. Dá para votar direto no site do Senado.
        </Txt>
        {openSite}
      </>
    );
  }
  if (!list) return <Loading label="Buscando no e-Cidadania..." />;

  const term = fold(q);
  const hits = term ? list.filter((c) => fold(`${c.label} ${c.text}`).includes(term)) : list;

  return (
    <>
      <Txt variant="small" muted>
        Consultas abertas no Senado. Toque em "Votar" para dar sua opinião no site do Senado — o voto é seu,
        com o seu cadastro lá; o app não vota por você.
      </Txt>
      {stale ? (
        <Banner tone="warning" title="Sem conexão" detail="Mostrando a última lista salva neste aparelho." />
      ) : null}
      <Field label="Buscar" value={q} onChangeText={setQ} placeholder="Tema ou número (ex.: saúde, PL 2557)" />

      <Txt variant="small" muted>
        {list.length} consultas carregadas{term ? ` · ${hits.length} com "${q.trim()}"` : ''}
      </Txt>
      {hits.length === 0 ? (
        <EmptyState title="Nada encontrado" detail="Tente outra palavra ou carregue mais consultas." />
      ) : (
        hits.map((c) => <ConsultationCard key={c.id} c={c} />)
      )}
      {more ? (
        <Button
          title="Carregar mais 100"
          kind="outline"
          small
          loading={loadingMore}
          onPress={() => void loadMore()}
        />
      ) : null}
      {openSite}
      <Txt variant="small" muted>
        Fonte: e-Cidadania, Senado Federal. Placar como publicado no site.
      </Txt>
    </>
  );
}

function ConsultationCard({ c }: { c: Consultation }) {
  const total = c.yes + c.no;
  const yesPct = total ? Math.round((c.yes / total) * 100) : 0;
  return (
    <Card>
      <Txt variant="heading">{c.label}</Txt>
      <SimpleText text={c.text} lines={6} />
      <View style={st.bar} accessibilityLabel={`Sim ${c.yes}, Não ${c.no}`}>
        <View style={[st.yes, { flex: Math.max(yesPct, 1) }]} />
        <View style={[st.no, { flex: Math.max(100 - yesPct, 1) }]} />
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="small">Sim {c.yes.toLocaleString('pt-BR')}</Txt>
        <Txt variant="small">Não {c.no.toLocaleString('pt-BR')}</Txt>
      </Row>
      <Button title="Votar no site do Senado" small onPress={() => void Linking.openURL(c.url)} />
    </Card>
  );
}

function Votes() {
  const router = useRouter();
  const [votes, setVotes] = useState<Vote[] | null>(null);
  const [stale, setStale] = useState(false);
  const [failed, setFailed] = useState<House[]>([]);

  const load = useCallback(async () => {
    const res = await listVotes();
    setVotes(res.votes);
    setStale(res.stale);
    setFailed(res.failed);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!votes) return <Loading label="Buscando nas fontes oficiais..." />;

  return (
    <>
      <Txt variant="small" muted>
        Últimas votações em plenário. Toque para ver como cada parlamentar votou (quando a votação é nominal)
        e o link oficial.
      </Txt>

      {stale ? (
        <Banner tone="warning" title="Sem conexão" detail="Mostrando a última lista salva neste aparelho." />
      ) : null}
      {failed.length ? (
        <Banner
          tone="warning"
          title={`${failed.map((h) => HOUSE[h].label).join(' e ')} fora do ar`}
          detail="A fonte oficial não respondeu agora. Puxe a tela para tentar de novo."
        />
      ) : null}

      {votes.length === 0 ? (
        <EmptyState
          title="Nenhuma votação recente"
          detail="Em período eleitoral o plenário quase não vota. Volte depois do 2º turno."
        />
      ) : (
        votes.map((v) => (
          <Card key={v.id} stripe={HOUSE[v.house].color} onPress={() => router.push(`/votacao/${v.id}`)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Badge label={HOUSE[v.house].label} color={HOUSE[v.house].color} />
              <Txt variant="small" muted>
                {brDate(v.date)}
              </Txt>
            </Row>
            {v.label ? <Txt variant="heading">{v.label}</Txt> : null}
            <SimpleText text={v.text} lines={5} />
            {v.author ? (
              <Txt variant="small">
                Autor da proposição: {v.author}
                {v.coauthors > 0 ? ` e mais ${v.coauthors}` : ''}
              </Txt>
            ) : null}
            {v.detail ? (
              <Txt variant="small" muted numberOfLines={3}>
                {v.detail}
              </Txt>
            ) : null}
            <Txt variant="small" tone="primary">
              Ver como cada um votou ›
            </Txt>
          </Card>
        ))
      )}

      <Txt variant="small" muted>
        Fonte: Dados Abertos da Câmara dos Deputados e do Senado Federal. Texto reproduzido como publicado.
      </Txt>
    </>
  );
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  yes: { backgroundColor: color.primary },
  no: { backgroundColor: color.accent },
});
