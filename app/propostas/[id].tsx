import { Linking } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { getCard } from '@/api/content';
import { areaLabel } from '@/data/areas';
import type { ProposalCard } from '@/lib/db.types';
import { shareCard } from '@/lib/share';
import {
  Button,
  Card,
  EmptyState,
  Loading,
  Row,
  Screen,
  Section,
  SeverityBadge,
  Txt,
  color,
} from '@/ui';
import { IconShare } from '@/ui/icons';

export default function DetalheProposta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [card, setCard] = useState<ProposalCard | null | 'loading'>('loading');

  useEffect(() => {
    void getCard(id).then(setCard);
  }, [id]);

  useEffect(() => {
    if (card && card !== 'loading') navigation.setOptions({ title: areaLabel(card.area) });
  }, [card, navigation]);

  if (card === 'loading') return <Loading />;
  if (!card) return <EmptyState title="Card não encontrado" detail="Ele pode ter sido despublicado." />;

  return (
    <Screen>
      <Row>
        <SeverityBadge level={card.severity} />
        <Txt variant="label" muted upper>
          {areaLabel(card.area)}
        </Txt>
      </Row>
      <Txt variant="display">{card.title}</Txt>

      <Section title="O que ele disse" />
      <Card stripe={color.neutral}>
        <Txt variant="body" style={{ fontStyle: 'italic' }}>
          "{card.what_they_said}"
        </Txt>
        {card.source_url ? (
          <Txt variant="small" tone="primary" onPress={() => void Linking.openURL(card.source_url!)}>
            Fonte: {card.source_name ?? card.source_url} › ver na íntegra
          </Txt>
        ) : card.source_name ? (
          <Txt variant="small" muted>
            Fonte: {card.source_name}
          </Txt>
        ) : null}
        {card.source_url && card.source_auto ? (
          <Txt variant="small" muted>
            Link achado pela busca automática — a equipe confere se a fonte diz isso.
          </Txt>
        ) : null}
      </Card>

      <Section title="O que significa" />
      <Txt variant="body">{card.what_it_means}</Txt>

      <Section title="Quem é afetado" />
      <Txt variant="body">{card.who_is_affected}</Txt>

      {card.comparison ? (
        <>
          <Section title="Comparação com Lula" />
          <Txt variant="body">{card.comparison}</Txt>
        </>
      ) : null}

      <Button
        title="Compartilhar"
        left={<IconShare size={18} color={color.textOnPrimary} />}
        onPress={() => void shareCard(card)}
      />
    </Screen>
  );
}
