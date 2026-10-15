import { Share } from 'react-native';
import type { FactCheck, ProposalCard } from '@/lib/db.types';
import { CHECK_LABEL } from '@/data/factChecks';
import { SEVERITY } from '@/ui/Badge';

/**
 * Compartilhamento por texto, pensando no WhatsApp.
 *
 * O contexto pede imagem gerada do card, mas isso exige render fora da tela
 * (react-native-view-shot) e pesa no bundle. Texto com fonte funciona em
 * qualquer aparelho e no 3G. Se um dia der tempo, é aqui que troca.
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
 * Compartilha checagem aprovada pela equipe (fact_checks). Checagem só da IA
 * não passa por aqui (revisão jurídica de 12/10): no WhatsApp quase ninguém lê
 * o aviso de "feita por IA" no fim, e o print corta.
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
    // link cru: o WhatsApp deixa clicável e quem recebe confere sozinho
    check.source_url,
    '',
    'Checado pela equipe do YvY.',
  ].filter(Boolean);
  await Share.share({ message: lines.join('\n') });
}
