import { Share } from 'react-native';
import type { FactCheck, ProposalCard } from '@/lib/db.types';
import { CHECK_LABEL } from '@/data/factChecks';
import { SEVERITY } from '@/ui/Badge';

/**
 * Compartilhamento por texto (WhatsApp e o canal principal, secao 10.2).
 *
 * O contexto pede imagem gerada do card. Imagem exige render off-screen
 * (react-native-view-shot) e sobe o custo do bundle; texto com fonte funciona
 * em qualquer aparelho e em 3G. Trocar aqui quando a fase de polimento chegar.
 */

export async function shareCard(card: ProposalCard): Promise<void> {
  const sev = SEVERITY[card.severity]?.label ?? '';
  const lines = [
    `${card.title.toUpperCase()} — ${sev}`,
    '',
    `O QUE ELE DISSE: "${card.what_they_said}"`,
    card.source_name ? `Fonte: ${card.source_name}` : null,
    card.source_url,
    '',
    `O QUE SIGNIFICA: ${card.what_it_means}`,
    '',
    `QUEM É AFETADO: ${card.who_is_affected}`,
    '',
    'Via YvY — app de organização de base.',
  ].filter(Boolean);
  await Share.share({ message: lines.join('\n') });
}

/**
 * Compartilha checagem APROVADA PELA EQUIPE (fact_checks). Checagem por IA
 * não passa por aqui (revisão jurídica de 12/10): no WhatsApp quase ninguém
 * lê o aviso "feita por IA" no fim, e o print corta.
 */
export async function shareCheck(check: {
  claim: string;
  result: FactCheck['result'];
  explanation: string;
  source_name: string | null;
  source_url: string | null;
}): Promise<void> {
  const lines = [
    `CHECAGEM: ${CHECK_LABEL[check.result].toUpperCase()}`,
    '',
    `"${check.claim}"`,
    '',
    check.explanation,
    check.source_name ? `Fonte: ${check.source_name}` : null,
    // Link cru: WhatsApp transforma em clicavel e quem recebe confere sozinho.
    check.source_url,
    '',
    'Checado pela equipe do YvY.',
  ].filter(Boolean);
  await Share.share({ message: lines.join('\n') });
}
