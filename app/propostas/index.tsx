import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { listCards } from '../../src/api/content';
import { presidentialCandidates, type Elected } from '../../src/api/elected';
import { AREAS, areaLabel } from '../../src/data/areas';
import type { ProposalCard } from '../../src/lib/db.types';
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
} from '../../src/ui';

/** Fluxo 4.7 — lista de cards de proposta por área. */
export default function Propostas() {
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

      <Txt variant="small" muted>
        Cada card traz a citação com fonte e data, a tradução do que significa e
        quem é afetado. Nada aqui é opinião do app.
      </Txt>

      <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
        <Chip label="Todas" active={area === 'all'} onPress={() => setArea('all')} />
        {AREAS.map((a) => (
          <Chip key={a.key} label={a.label} active={area === a.key} onPress={() => setArea(a.key)} />
        ))}
      </Row>

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
