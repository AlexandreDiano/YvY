import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { getGovernmentPlan, planPageUrl, type GovernmentPlan } from '@/api/elected';
import { listPromises, promiseHistory, setPromiseStatus } from '@/api/promises';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  PROMISE_LABEL,
  PROMISE_STATUSES,
  UNRATED_LABEL,
  matchesFilter,
  parseBrDate,
  summarize,
  updateProblem,
  type PlanPromise,
  type PromiseFilter,
  type PromiseStatus,
  type PromiseUpdate,
} from '@/features/plans/promiseRules';
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
  Options,
  Row,
  Screen,
  Section,
  Txt,
  color,
  space,
} from '@/ui';

/**
 * Plano de governo registrado no TSE e monitor de promessas (YVY-130).
 *
 * Cada item é trecho copiado do plano, com a página, e conferido palavra por
 * palavra contra o PDF (scripts/verify-plans.py). Nada aqui é resumo nosso.
 * O status de cada promessa é registrado pela equipe (moderador/admin), sempre
 * com link oficial, data e nota; sem registro, aparece "sem avaliação".
 */
const STATUS_COLOR: Record<PromiseStatus, string> = {
  not_started: color.neutral,
  in_progress: color.warning,
  fulfilled: color.success,
  partial: color.accent,
  broken: color.danger,
};

function StatusBadge({ status }: { status: PromiseStatus | null }) {
  return status ? (
    <Badge label={PROMISE_LABEL[status]} color={STATUS_COLOR[status]} />
  ) : (
    <Badge label={UNRATED_LABEL} />
  );
}

export default function Plano() {
  const { sq } = useLocalSearchParams<{ sq: string }>();
  const { isModerator } = useAuth();
  const [plan, setPlan] = useState<GovernmentPlan | null | undefined>(undefined);
  const [promises, setPromises] = useState<PlanPromise[] | null>(null);
  const [stale, setStale] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<PromiseFilter>('all');
  const [tema, setTema] = useState<string>('all');

  const loadPromises = useCallback(
    () =>
      sq
        ? listPromises(sq).then(
            (r) => {
              setPromises(r.promises);
              setStale(r.stale);
            },
            () => setPromises([]),
          )
        : Promise.resolve(),
    [sq],
  );

  useEffect(() => {
    if (!sq) return;
    getGovernmentPlan(sq).then(setPlan, () => setPlan(null));
    listPromises(sq).then(
      (r) => {
        setPromises(r.promises);
        setStale(r.stale);
      },
      () => setPromises([]),
    );
  }, [sq]);

  if (plan === undefined || promises === null) return <Loading label="Carregando plano..." />;
  if (!plan) {
    return (
      <Screen>
        <EmptyState title="Plano ainda não importado" detail="O plano deste candidato ainda não foi trazido do TSE." />
      </Screen>
    );
  }

  // Sem as views do monitor (migration ainda não aplicada, rede): mostra os
  // trechos do plano sem status, como antes, e sem registrar andamento.
  const tracked = promises.length > 0 || plan.items.length === 0;
  const all: PlanPromise[] = !plan.verified
    ? []
    : tracked
      ? promises
      : plan.items.map((i, n) => ({
          sq_candidato: plan.sq_candidato,
          promise_key: `item-${n}`,
          position: n + 1,
          tema: i.tema,
          texto: i.texto,
          pagina: i.pagina ?? null,
          status: null,
          source_url: null,
          evidence_date: null,
          note: null,
          updated_at: null,
        }));
  const sum = summarize(all);
  const temas = [...new Set(all.map((p) => p.tema || 'Outros'))];
  const term = q.trim().toLowerCase();
  const hits = all.filter(
    (p) =>
      matchesFilter(p, status) &&
      (tema === 'all' || (p.tema || 'Outros') === tema) &&
      (!term || `${p.tema} ${p.texto}`.toLowerCase().includes(term)),
  );
  const byTema = new Map<string, PlanPromise[]>();
  for (const p of hits) byTema.set(p.tema || 'Outros', [...(byTema.get(p.tema || 'Outros') ?? []), p]);

  return (
    <Screen>
      <Txt variant="title">{plan.nome_urna}</Txt>
      <Txt variant="small" muted>
        {plan.cargo} · {plan.partido} · Plano de governo registrado no TSE{plan.pages ? ` · ${plan.pages} páginas` : ''}
      </Txt>
      <Button title="Ver o plano na íntegra (PDF oficial)" onPress={() => void Linking.openURL(plan.pdf_url)} />
      {stale ? <Banner tone="warning" title="Sem conexão" detail="Mostrando o andamento salvo no aparelho." /> : null}

      <Section title="Promessas do plano" />
      {!plan.verified ? (
        <Txt variant="small" muted>
          A lista de propostas está em conferência. Enquanto isso, abra o plano completo acima.
        </Txt>
      ) : (
        <>
          <Card>
            <Txt variant="heading">
              {sum.fulfilled} de {sum.total} cumpridas
            </Txt>
            <Txt variant="small" muted>
              {sum.partial} parcialmente · {sum.in_progress} em andamento · {sum.not_started} não iniciadas ·{' '}
              {sum.broken} abandonadas ou contrárias · {sum.unrated} sem avaliação
            </Txt>
          </Card>
          <Txt variant="small" muted>
            Trechos copiados do plano, como o candidato escreveu, com a página. O andamento é registrado pela equipe do
            Yvy, sempre com link para a fonte oficial e data. "Sem avaliação" quer dizer que ainda não registramos nada.
          </Txt>

          <Row style={{ flexWrap: 'wrap', gap: space.sm }}>
            <Chip label="Todas" active={status === 'all'} onPress={() => setStatus('all')} />
            {PROMISE_STATUSES.map((s) => (
              <Chip key={s} label={PROMISE_LABEL[s]} active={status === s} onPress={() => setStatus(s)} />
            ))}
            <Chip label={UNRATED_LABEL} active={status === 'unrated'} onPress={() => setStatus('unrated')} />
          </Row>
          {temas.length > 1 ? (
            <Row style={{ flexWrap: 'wrap', gap: space.sm }}>
              <Chip label="Todos os temas" active={tema === 'all'} onPress={() => setTema('all')} />
              {temas.map((t) => (
                <Chip key={t} label={t} active={tema === t} onPress={() => setTema(t)} />
              ))}
            </Row>
          ) : null}
          <Field label="Buscar no plano" value={q} onChangeText={setQ} placeholder="Ex.: saúde, imposto, SUS" />

          {hits.length === 0 ? (
            <Txt variant="small" muted>
              Nada encontrado com esses filtros. O plano completo pode ter mais.
            </Txt>
          ) : (
            [...byTema.entries()].map(([t, list]) => (
              <View key={t} style={{ gap: space.sm }}>
                <Txt variant="label" muted upper>
                  {t}
                </Txt>
                {list.map((p) => (
                  <PromiseCard
                    key={p.promise_key}
                    plan={plan}
                    promise={p}
                    canEdit={isModerator && tracked}
                    onSaved={loadPromises}
                  />
                ))}
              </View>
            ))
          )}
        </>
      )}
      <Txt variant="small" muted>
        Fonte do plano: TSE, dados abertos (proposta de governo 2026). Fonte de cada andamento: o link no histórico.
      </Txt>
    </Screen>
  );
}

function PromiseCard({
  plan,
  promise: p,
  canEdit,
  onSaved,
}: {
  plan: GovernmentPlan;
  promise: PlanPromise;
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  const [history, setHistory] = useState<PromiseUpdate[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  async function loadHistory() {
    try {
      setHistory(await promiseHistory(p.sq_candidato, p.promise_key));
    } catch {
      setHistory([]);
    }
  }

  function toggleHistory() {
    if (!open && history === null) void loadHistory();
    setOpen(!open);
  }

  return (
    <Card>
      <StatusBadge status={p.status} />
      <Txt variant="body">"{p.texto}"</Txt>
      {p.pagina ? (
        <Txt
          variant="small"
          tone="primary"
          onPress={() => void Linking.openURL(planPageUrl(plan, p.pagina ?? undefined))}
        >
          Página {p.pagina} do plano ›
        </Txt>
      ) : null}
      {p.status && p.source_url ? (
        <View style={{ gap: space.xs }}>
          <Txt variant="small" muted>
            {p.evidence_date ? `${brDate(p.evidence_date)} · ` : ''}
            {p.note}
          </Txt>
          <Txt variant="small" tone="primary" onPress={() => void Linking.openURL(p.source_url!)}>
            Ver a fonte ›
          </Txt>
        </View>
      ) : null}
      <Row style={{ flexWrap: 'wrap', gap: space.sm }}>
        {p.status ? (
          <Button
            small
            block={false}
            kind="ghost"
            title={open ? 'Fechar histórico' : 'Ver histórico'}
            onPress={toggleHistory}
          />
        ) : null}
        {canEdit ? (
          <Button
            small
            block={false}
            kind="outline"
            title={editing ? 'Cancelar' : 'Registrar andamento'}
            onPress={() => setEditing(!editing)}
          />
        ) : null}
      </Row>
      {open ? (
        history === null ? (
          <Txt variant="small" muted>
            Carregando histórico...
          </Txt>
        ) : (
          <View style={{ gap: space.sm }}>
            {history.map((h) => (
              <View
                key={h.id}
                style={{ gap: space.xs, borderLeftWidth: 2, borderLeftColor: color.border, paddingLeft: space.sm }}
              >
                <StatusBadge status={h.status} />
                <Txt variant="small" muted>
                  {brDate(h.evidence_date)} · {h.note}
                </Txt>
                <Txt variant="small" tone="primary" onPress={() => void Linking.openURL(h.source_url)}>
                  Fonte ›
                </Txt>
              </View>
            ))}
          </View>
        )
      ) : null}
      {editing ? (
        <StatusForm
          promise={p}
          onDone={async () => {
            setEditing(false);
            setHistory(null);
            setOpen(false);
            await onSaved();
          }}
        />
      ) : null}
    </Card>
  );
}

function StatusForm({ promise: p, onDone }: { promise: PlanPromise; onDone: () => Promise<void> }) {
  const [status, setStatus] = useState<PromiseStatus>(p.status ?? 'in_progress');
  const [url, setUrl] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const problem = updateProblem({ url, date, note });
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      await setPromiseStatus({
        sq: p.sq_candidato,
        key: p.promise_key,
        status,
        sourceUrl: url,
        date: parseBrDate(date)!,
        note,
      });
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível registrar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <Options
        label="Status"
        value={status}
        options={PROMISE_STATUSES.map((s) => ({ key: s, label: PROMISE_LABEL[s] }))}
        onChange={setStatus}
      />
      <Field
        label="Link da fonte oficial"
        value={url}
        onChangeText={setUrl}
        placeholder="https://www.planalto.gov.br/..."
        autoCapitalize="none"
        keyboardType="url"
        hint="Lei, decreto, MP, projeto enviado, programa lançado, dado de orçamento."
      />
      <Field
        label="Data da prova"
        value={date}
        onChangeText={setDate}
        placeholder="DD/MM/AAAA"
        keyboardType="numbers-and-punctuation"
      />
      <Field
        label="Nota (curta e neutra)"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={280}
        placeholder="O que a fonte mostra, sem opinião."
      />
      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : null}
      <Button title="Registrar" loading={saving} onPress={() => void save()} />
    </View>
  );
}
