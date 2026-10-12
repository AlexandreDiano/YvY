import type { CheckResult, FactCheck } from '@/lib/db.types';

/**
 * Base de checagem inicial — secao 6.2 de docs/CONTEXT.md.
 * Mesma regra editorial de cards.ts: transcricao literal, com fonte.
 */

export type SeedCheck = Omit<FactCheck, 'id' | 'created_at' | 'is_active'>;

export const SEED_CHECKS: SeedCheck[] = [
  {
    claim_text: 'Flávio vai privatizar a Petrobras',
    result: 'half_true',
    explanation:
      'O coordenador econômico descarta privatizar Petrobras, BB e Caixa "por enquanto", mas o programa de desestatização está de volta.',
    source_name: 'Forbes, 10/2026',
    source_url: null,
  },
  {
    claim_text: 'Flávio vai cortar o Bolsa Família',
    result: 'false',
    explanation:
      'O plano de governo diz "manter programas assistenciais existentes". O que muda é o piso do BPC (só inflação, sem aumento real).',
    source_name: 'Plano de governo',
    source_url: null,
  },
  {
    claim_text: 'Lula quer aumentar impostos',
    result: 'half_true',
    explanation:
      'Lula propõe manter o arcabouço fiscal e fazer concessões em infraestrutura. Não há proposta de novo imposto, mas a reforma tributária (suspensa por Flávio) muda a alíquota de consumo.',
    source_name: 'Invest News, 10/2026',
    source_url: null,
  },
  {
    claim_text: 'Flávio vai acabar com o SUS',
    result: 'exaggeration',
    explanation:
      'Ele propõe "reformular o financiamento" e contratar rede privada. Não é extinção, mas é mudança estrutural que reduz o papel do SUS.',
    source_name: 'Plano de governo',
    source_url: null,
  },
  {
    claim_text: 'Lula é responsável pela inflação',
    result: 'half_true',
    explanation:
      'A inflação é multifatorial (ciclo global, câmbio, energia). Lula mantém o arcabouço fiscal, mas o BC controla a taxa de juros. Culpar só o governo é simplificar.',
    source_name: 'Banco Central, 2026',
    source_url: null,
  },
  {
    claim_text: 'Flávio vai anistiar só o pai',
    result: 'false',
    explanation:
      'A anistia proposta cobre TODOS os envolvidos no 8 de janeiro, incluindo condenados pelo STF. Jair Bolsonaro é um deles, mas não o único.',
    source_name: 'Plano de governo',
    source_url: null,
  },
];

/** Selo visual de cada resultado (tela 7.8). */
export const CHECK_LABEL: Record<CheckResult, string> = {
  true: 'Verdade',
  half_true: 'Meio verdade',
  exaggeration: 'Exagero',
  false: 'Mentira',
  unverified: 'Não verificamos ainda',
};
