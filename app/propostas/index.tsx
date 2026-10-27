import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { listCards } from '@/api/content';
import { presidentialCandidates, type Elected } from '@/api/elected';
import { AREAS, areaLabel } from '@/data/areas';
import { electionOver } from '@/lib/format';
import type { ProposalCard } from '@/lib/db.types';
import {
  Banner,
  Button,
  Card,
  Chip,
  Loading,
  Row,
  Screen,
  Section,
  SeverityBadge,
  Txt,
  color,
  space,
  EmptyState,
} from '@/ui';

export default function Propostas() {
  if (electionOver()) return <AfterElection />;
  return <BeforeElection />;
}

/**
 * Depois do 2º turno: só o plano do presidente eleito. Os cards comentados eram
 * comparação de campanha e saem da lista (a página de cada um continua no ar,
 * para quem tem o link). O acompanhamento das promessas é o YVY-130.
 */
function AfterElection() {
  const router = useRouter();
  const [elected, setElected] = useState<Elected[] | null>(null);

  useEffect(() => {
    void presidentialCandidates().then(setElected, () => setElected([]));
  }, []);

  if (!elected) return <Loading label="Carregando..." />;

  return (
    <Screen>
      <Section title="Presidente eleito" />
      {elected.length === 0 ? (
        <EmptyState
          title="Resultado em atualização"
          detail="O resultado oficial do 2º turno ainda não foi trazido do TSE. Volte em breve."
        />
      ) : (
        <>
          <Txt variant="small" muted>
            Plano de governo que o eleito registrou no TSE antes da eleição: propostas com página e o PDF completo.
          </Txt>
          {elected.map((c) => (
            <Card key={c.sq_candidato}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="heading">{c.nome_urna}</Txt>
                <Txt variant="small" muted>
                  {c.partido}
                </Txt>
              </Row>
              <Button
                title="Ver plano de governo"
                kind="outline"
                small
                onPress={() => router.push(`/plano/${c.sq_candidato}`)}
              />
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

function BeforeElection() {
  const router = useRouter();
  const [cards, setCards] = useState<ProposalCard[] | null>(null);
  const [stale, setStale] = useState(false);
  const [area, setArea] = useState<string>('all');
  const [candidates, setCandidates] = useState<Elected[]>([]);

  useEffect(() => {
    void presidentialCandidates().then(setCandidates, () => setCandidates([]));
    void listCards().then(({ cards: list, stale: s }) => {
      setCards(list);
      setStale(s);
    });
  }, []);

  if (!cards) return <Loading label="Carregando propostas..." />;

  const visible = area === 'all' ? cards : cards.filter((c) => c.area === area);

  return (
    <Screen>
      {stale ? (
        <Banner tone="warning" title="Sem conexão" detail="Mostrando o conteúdo salvo no aparelho." />
      ) : null}

      {candidates.length ? (
        <>
          <Section title="Candidatos a presidente" />
          <Txt variant="small" muted>
            Plano de governo oficial de cada candidato, registrado no TSE: propostas com página e o PDF completo.
          </Txt>
          {candidates.map((c) => (
            <Card key={c.sq_candidato}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="heading">{c.nome_urna}</Txt>
                <Txt variant="small" muted>
                  {c.partido}
                </Txt>
              </Row>
              <Button
                title="Ver plano de governo"
                kind="outline"
                small
                onPress={() => router.push(`/plano/${c.sq_candidato}`)}
              />
            </Card>
          ))}
          <Section title="Propostas comentadas" />
        </>
      ) : null}

      {cards.length === 0 ? (
        <EmptyState
          title="Propostas comentadas em revisão"
          detail="Cada card só volta ao ar com link para a fonte original. Enquanto isso, veja os planos de governo oficiais acima."
        />
      ) : (
        <Txt variant="small" muted>
          Cada card traz a citação com fonte e data, a tradução do que significa e
          quem é afetado. Nada aqui é opinião do app.
        </Txt>
      )}

      {cards.length > 0 ? (
        <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
          <Chip label="Todas" active={area === 'all'} onPress={() => setArea('all')} />
          {AREAS.map((a) => (
            <Chip key={a.key} label={a.label} active={area === a.key} onPress={() => setArea(a.key)} />
          ))}
        </Row>
      ) : null}

      {(area === 'all' ? AREAS.map((a) => a.key) : [area]).map((key) => {
        const group = visible
          .filter((c) => c.area === key)
          .sort((a, b) => a.sort_order - b.sort_order);
        if (!group.length) return null;
        return (
          <View key={key} style={{ gap: space.md }}>
            <Section title={areaLabel(key)} />
            {group.map((c) => (
              <Card
                key={c.id}
                stripe={severityColor(c.severity)}
                onPress={() => router.push(`/propostas/${c.id}`)}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <SeverityBadge level={c.severity} />
                  <Txt variant="label" muted upper>
                    {areaLabel(c.area)}
                  </Txt>
                </Row>
                <Txt variant="heading">{c.title}</Txt>
                <Txt variant="small" muted numberOfLines={3}>
                  {c.what_it_means}
                </Txt>
              </Card>
            ))}
          </View>
        );
      })}

    </Screen>
  );
}

function severityColor(s: ProposalCard['severity']): string {
  return { critical: color.danger, high: color.accent, medium: color.warning, low: color.neutral }[s];
}
