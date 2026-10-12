import { Share } from 'react-native';
import type { FactCheck, ProposalCard } from './db.types';
import { CHECK_LABEL } from '../data/factChecks';
import { SEVERITY } from '../ui/Badge';
import { brDate } from './format';

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

export async function shareCheck(check: {
  claim: string;
  result: FactCheck['result'];
  explanation: string;
  source_name: string | null;
  source_url: string | null;
  /** Preenchido quando a checagem é automática (IA): vai rotulada no texto. */
  autoCheckedAt?: string | null;
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
    check.autoCheckedAt
      ? `Checagem automática feita por IA em ${brDate(check.autoCheckedAt)}, não revisada pela equipe. Confira a fonte.`
      : 'Checado no YvY.',
  ].filter(Boolean);
  await Share.share({ message: lines.join('\n') });
}
