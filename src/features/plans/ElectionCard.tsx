import { daysToElection, electionLabel, electionOver } from '@/lib/format';
import { Card, Txt, color } from '@/ui';

/** Topo do Início e da área pública: contagem até o 2º turno e, depois dele, o aviso de que acabou. */
export function ElectionCard() {
  if (electionOver()) {
    return (
      <Card stripe={color.accent}>
        <Txt variant="heading">Eleições 2026 encerradas</Txt>
        <Txt variant="small" muted>
          Agora é acompanhar o que quem foi eleito faz. Tomam posse em 2027.
        </Txt>
      </Card>
    );
  }
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
