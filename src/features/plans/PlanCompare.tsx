import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import {
  PLAN_THEMES,
  planItemsFor,
  planPageUrl,
  presidentialPlans,
  type GovernmentPlan,
} from '@/api/elected';
import { Button, Card, Chip, Row, Section, Txt, space } from '@/ui';

/**
 * Comparação por tema entre os planos de governo dos candidatos a presidente.
 *
 * Imparcial por construção: mesmo tema, mesma quantidade de trechos para cada
 * candidato, ordem alfabética, e o texto é copiado do plano registrado no TSE
 * (conferido palavra a palavra contra o PDF) — sem resumo nem comentário.
 */
export function PlanCompare() {
  const router = useRouter();
  const [plans, setPlans] = useState<GovernmentPlan[] | null>(null);
  const [theme, setTheme] = useState(PLAN_THEMES[0]!.key);

  useEffect(() => {
    void presidentialPlans().then(setPlans, () => setPlans([]));
  }, []);

  if (!plans || plans.length < 2) return null;

  return (
    <>
      <Section title="O que cada candidato propõe" />
      <Txt variant="small" muted>
        Trechos copiados dos planos de governo registrados no TSE. Mesmo tema, mesma regra para os dois.
      </Txt>
      <Row style={{ flexWrap: 'wrap' }}>
        {PLAN_THEMES.map((t) => (
          <Chip key={t.key} label={t.label} active={theme === t.key} onPress={() => setTheme(t.key)} />
        ))}
      </Row>
      {plans.map((p) => {
        const items = planItemsFor(p, theme);
        return (
          <Card key={p.sq_candidato}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="heading">{p.nome_urna}</Txt>
              <Txt variant="small" muted>
                {p.partido}
              </Txt>
            </Row>
            {items.length === 0 ? (
              <Txt variant="small" muted>
                Nenhum trecho sobre este tema entre as propostas listadas. Veja o plano completo.
              </Txt>
            ) : (
              items.map((i, n) => (
                <View key={n} style={{ gap: space.xs }}>
                  <Txt variant="body">"{i.texto}"</Txt>
                  <Txt
                    variant="small"
                    tone="primary"
                    onPress={() => void Linking.openURL(planPageUrl(p, i.pagina))}
                  >
                    Página {i.pagina} do plano ›
                  </Txt>
                </View>
              ))
            )}
            <Button
              title="Ver plano completo"
              kind="ghost"
              small
              block={false}
              onPress={() => router.push(`/plano/${p.sq_candidato}`)}
            />
          </Card>
        );
      })}
    </>
  );
}
