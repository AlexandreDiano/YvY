import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { presidentialCandidates, type Elected } from '@/api/elected';
import { daysToElection, electionLabel, electionOver } from '@/lib/format';
import { Card, Txt, color } from '@/ui';

/**
 * Topo do Início e da área pública: contagem até o 2º turno e, depois dele, o
 * aviso de que acabou com entrada para o monitor de promessas do eleito (YVY-130).
 */
export function ElectionCard() {
  if (electionOver()) return <AfterElection />;
  const dias = daysToElection();
  return (
    <Card stripe={color.accent}>
      <Txt variant="heading">
        {dias > 0 ? `${dias} ${dias === 1 ? 'dia' : 'dias'} para o 2º turno` : 'Hoje é dia de votar'}
      </Txt>
      <Txt variant="small" muted>
        Votação: {electionLabel()}
      </Txt>
    </Card>
  );
}

function AfterElection() {
  const router = useRouter();
  const [elected, setElected] = useState<Elected | null>(null);

  useEffect(() => {
    void presidentialCandidates().then(
      (list) => setElected(list[0] ?? null),
      () => setElected(null),
    );
  }, []);

  // Sem o resultado importado, Propostas explica o "em atualização".
  const open = () => router.push(elected ? `/plano/${elected.sq_candidato}` : '/propostas');

  return (
    <Card stripe={color.accent} onPress={open}>
      <Txt variant="heading">Eleições 2026 encerradas</Txt>
      <Txt variant="small" muted>
        {elected
          ? `Acompanhe as promessas do plano de governo de ${elected.nome_urna}, com o status de cada uma. Toque para abrir.`
          : 'Agora é acompanhar o que quem foi eleito faz. Tomam posse em 2027.'}
      </Txt>
    </Card>
  );
}
