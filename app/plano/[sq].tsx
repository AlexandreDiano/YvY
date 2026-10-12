import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { getGovernmentPlan, planPageUrl, type GovernmentPlan, type PlanItem } from '../../src/api/elected';
import { Button, Card, EmptyState, Field, Loading, Screen, Section, Txt, space } from '../../src/ui';

/**
 * Plano de governo oficial (registrado no TSE), dentro do app.
 *
 * Os itens são trechos COPIADOS do plano, com a página — conferidos palavra a
 * palavra contra o PDF (scripts/verify-plans.py). Nada aqui é resumo nosso.
 * "Ver na íntegra" abre o PDF oficial completo.
 */
export default function Plano() {
  const { sq } = useLocalSearchParams<{ sq: string }>();
  const [plan, setPlan] = useState<GovernmentPlan | null | undefined>(undefined);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (sq) getGovernmentPlan(sq).then(setPlan, () => setPlan(null));
  }, [sq]);

  if (plan === undefined) return <Loading label="Carregando plano..." />;
  if (!plan) {
    return (
      <Screen>
        <EmptyState title="Plano ainda não importado" detail="O plano deste candidato ainda não foi trazido do TSE." />
      </Screen>
    );
  }

  const term = q.trim().toLowerCase();
  const items = plan.verified ? plan.items : [];
  const hits = term ? items.filter((i) => `${i.tema} ${i.texto}`.toLowerCase().includes(term)) : items;
  const byTema = new Map<string, PlanItem[]>();
  for (const i of hits) byTema.set(i.tema || 'Outros', [...(byTema.get(i.tema || 'Outros') ?? []), i]);

  return (
    <Screen>
      <Txt variant="title">{plan.nome_urna}</Txt>
      <Txt variant="small" muted>
        {plan.cargo} · {plan.partido} · Plano de governo registrado no TSE{plan.pages ? ` · ${plan.pages} páginas` : ''}
      </Txt>
      <Button title="Ver o plano na íntegra (PDF oficial)" onPress={() => void Linking.openURL(plan.pdf_url)} />

      <Section title="Propostas do plano" />
      {!plan.verified ? (
        <Txt variant="small" muted>
          A lista de propostas está em conferência. Enquanto isso, abra o plano completo acima.
        </Txt>
      ) : (
        <>
          <Txt variant="small" muted>
            Trechos copiados do plano, como o candidato escreveu, com a página. Toque na página para conferir no
            PDF.
          </Txt>
          <Field label="Buscar no plano" value={q} onChangeText={setQ} placeholder="Ex.: saúde, imposto, SUS" />
          {hits.length === 0 ? (
            <Txt variant="small" muted>
              Nada encontrado nos trechos. O plano completo pode ter mais.
            </Txt>
          ) : (
            [...byTema.entries()].map(([tema, list]) => (
              <View key={tema} style={{ gap: space.sm }}>
                <Txt variant="label" muted upper>
                  {tema}
                </Txt>
                {list.map((i, n) => (
                  <Card key={`${tema}-${n}`}>
                    <Txt variant="body">"{i.texto}"</Txt>
                    <Txt
                      variant="small"
                      tone="primary"
                      onPress={() => void Linking.openURL(planPageUrl(plan, i.pagina))}
                    >
                      Página {i.pagina} do plano ›
                    </Txt>
                  </Card>
                ))}
              </View>
            ))
          )}
        </>
      )}
      <Txt variant="small" muted>
        Fonte: TSE, dados abertos (proposta de governo 2026).
      </Txt>
    </Screen>
  );
}
