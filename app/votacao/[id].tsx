import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { getVote, listBallots, type Ballot, type Vote } from '@/api/officials';
import { useAuth } from '@/features/auth/AuthProvider';
import { brDate } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Loading,
  Row,
  Screen,
  Section,
  SimpleText,
  Txt,
  color,
  space,
} from '@/ui';

const GROUP_COLOR: Record<string, string> = { 'Sim': color.primary, 'Não': color.accent };

/**
 * Uma votação e como cada parlamentar votou. Lista e placar vêm da fonte
 * oficial; o app só agrupa por voto e filtra por UF. Votação simbólica ou
 * secreta não tem registro individual — a tela diz isso em vez de inventar.
 */
export default function Votacao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [vote, setVote] = useState<Vote | null | undefined>(undefined);
  const [ballots, setBallots] = useState<Ballot[] | null>(null);
  const [error, setError] = useState(false);
  const [scope, setScope] = useState<'br' | 'uf'>(profile?.state ? 'uf' : 'br');
  const [q, setQ] = useState('');
  const [step, setStep] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getVote(id).then(
      (v) => {
        setVote(v);
        setStep(v?.steps?.[0]?.id ?? v?.id ?? null);
      },
      () => setVote(null),
    );
  }, [id]);

  useEffect(() => {
    if (!vote || !step) return;
    setBallots(null);
    setError(false);
    listBallots(vote, step).then(setBallots, () => {
      setError(true);
      setBallots([]);
    });
  }, [vote, step]);

  if (vote === undefined) return <Loading label="Buscando a votação..." />;
  if (!vote) {
    return (
      <Screen>
        <EmptyState title="Votação não encontrada" detail="Volte e abra a lista de novo." />
      </Screen>
    );
  }

  const uf = profile?.state ?? null;
  const term = q.trim().toLowerCase();
  const shown = (ballots ?? []).filter(
    (b) =>
      (scope === 'br' || !uf || b.uf === uf) &&
      (!term || `${b.name} ${b.party} ${b.uf}`.toLowerCase().includes(term)),
  );
  const groups = new Map<string, Ballot[]>();
  for (const b of shown) groups.set(b.vote, [...(groups.get(b.vote) ?? []), b]);
  const order = [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Badge
          label={vote.house === 'camara' ? 'Câmara' : 'Senado'}
          color={vote.house === 'camara' ? color.primary : color.accent}
        />
        <Txt variant="small" muted>
          {brDate(vote.date)}
        </Txt>
      </Row>
      {vote.label ? <Txt variant="title">{vote.label}</Txt> : null}
      <SimpleText text={vote.text} />
      {vote.author ? (
        <Txt variant="small">
          Autor da proposição: {vote.author}
          {vote.coauthors > 0 ? ` e mais ${vote.coauthors}` : ''}
        </Txt>
      ) : null}
      {vote.steps && vote.steps.length > 1 ? (
        <>
          <Section title={`Votações desta sessão · ${vote.steps.length}`} />
          {vote.steps.map((st, i) => (
            <Card key={st.id} stripe={st.id === step ? color.primary : color.border} onPress={() => setStep(st.id)}>
              <Txt variant="label" muted upper>
                {i + 1}ª votação{st.id === step ? ' · mostrando os votos abaixo' : ''}
              </Txt>
              <Txt variant="small">{st.detail ?? 'Sem descrição.'}</Txt>
            </Card>
          ))}
        </>
      ) : vote.detail ? (
        <Txt variant="small" muted>
          {vote.detail}
        </Txt>
      ) : null}
      <Button title="Abrir no site oficial" kind="outline" small onPress={() => void Linking.openURL(vote.url)} />

      <Section title="Como cada um votou" />
      {ballots === null ? (
        <Loading />
      ) : error ? (
        <Txt variant="small" tone="danger">
          A fonte oficial não respondeu. Tente de novo em instantes.
        </Txt>
      ) : ballots.length === 0 ? (
        <Card>
          <Txt variant="body">
            Esta foi uma votação simbólica ou secreta: não há registro do voto de cada parlamentar. Só o
            resultado é público.
          </Txt>
        </Card>
      ) : (
        <>
          <Row style={{ flexWrap: 'wrap' }}>
            {uf ? <Chip label={`Minha região (${uf})`} active={scope === 'uf'} onPress={() => setScope('uf')} /> : null}
            <Chip label="Brasil todo" active={scope === 'br'} onPress={() => setScope('br')} />
          </Row>
          <Field label="Buscar" value={q} onChangeText={setQ} placeholder="Nome, partido ou UF" />
          <Row style={{ flexWrap: 'wrap' }}>
            {order.map((g) => (
              <Badge key={g} label={`${g}: ${groups.get(g)!.length}`} color={GROUP_COLOR[g] ?? color.neutral} />
            ))}
          </Row>
          {order.map((g) => (
            <View key={g} style={{ gap: space.xs }}>
              <Txt variant="label" muted upper>
                {g} · {groups.get(g)!.length}
              </Txt>
              {groups.get(g)!.map((b) => (
                <Txt key={`${g}-${b.name}-${b.uf}`} variant="small">
                  {b.name} · {b.party}/{b.uf}
                </Txt>
              ))}
            </View>
          ))}
        </>
      )}

      <Txt variant="small" muted>
        Fonte: Dados Abertos da {vote.house === 'camara' ? 'Câmara dos Deputados' : 'Senado Federal'}.
      </Txt>
    </Screen>
  );
}

function rank(vote: string): number {
  return { 'Sim': 0, 'Não': 1, 'Abstenção': 2, 'Obstrução': 3 }[vote] ?? 9;
}
