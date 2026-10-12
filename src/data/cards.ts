import type { ProposalCard, Severity } from '../lib/db.types';

/**
 * Cards de propostas — conteudo inicial, secao 6.1 de docs/CONTEXT.md.
 *
 * REGRA EDITORIAL: transcricao literal do documento, com fonte e data. Nao
 * reescrever, nao resumir, nao acrescentar afirmacao sobre o que o candidato
 * vai fazer. Mudanca de conteudo e decisao da equipe editorial, nao do codigo.
 *
 * Fonte unica de verdade: este arquivo gera supabase/seed/0002_proposal_cards.sql
 * via `node scripts/gen-seed-sql.mjs`.
 */

export type SeedCard = Omit<ProposalCard, 'id' | 'created_at' | 'updated_at' | 'is_active'>;

export const SEED_CARDS: SeedCard[] = [
  {
    area: 'trabalho',
    title: 'PEC 12: Pagamento por Hora',
    what_they_said:
      'Flexibilizar a CLT para permitir o pagamento por hora (PEC 12/2026).',
    source_name: 'Plano de governo, setembro/2026',
    source_date: '2026-09-01',
    source_url: null,
    what_it_means:
      'O trabalhador só recebe pelas horas efetivamente trabalhadas. Na escala 5×2, o salário mínimo pode cair de R$ 1.518 para R$ 1.297. Férias, 13º e FGTS continuam, mas a base de cálculo muda.',
    who_is_affected:
      'Todo trabalhador CLT, especialmente quem faz escala 6x1 ou 5x2. Você, seu filho, seu vizinho.',
    comparison:
      'Lula propõe o fim da escala 6x1 (PEC em tramitação no Senado). Flávio propõe o oposto: pagamento por hora, que reduz a renda de quem trabalha 6 dias.',
    severity: 'critical' satisfies Severity,
    sort_order: 1,
  },
  {
    area: 'trabalho',
    title: 'Fim da 6x1? Não.',
    what_they_said:
      'A campanha de Flávio chama o debate da escala 6x1 de "tentativa de mudar o foco". O plano de governo NÃO propõe acabar com a 6x1.',
    source_name: 'R7, 27/08/2026',
    source_date: '2026-08-27',
    source_url: null,
    what_it_means:
      'Enquanto Lula promete fim da 6x1, Flávio quer o contrário: pagamento por hora, que na prática reduz a renda de quem trabalha 6 dias.',
    who_is_affected: 'Trabalhadores de comércio, serviços, saúde, educação.',
    comparison: null,
    severity: 'high',
    sort_order: 2,
  },
  {
    area: 'trabalho',
    title: 'Contrato Jovem (18–24 anos)',
    what_they_said:
      'Criar contratos de trabalho para jovens de 18 a 24 anos em busca do primeiro emprego.',
    source_name: 'Plano de governo',
    source_date: null,
    source_url: null,
    what_it_means:
      'Contrato com regras diferentes da CLT para jovens. Na prática: salário menor, menos direitos, mais fácil demitir.',
    who_is_affected: 'Jovens que entram no mercado de trabalho.',
    comparison: null,
    severity: 'medium',
    sort_order: 3,
  },
  {
    area: 'saude',
    title: '"Plano Real da Saúde"',
    what_they_said:
      'Reformular o SUS, alterando o financiamento e valorizando os profissionais de saúde. Contratar serviços e exames na rede privada nos horários ociosos.',
    source_name: 'Plano de governo',
    source_date: null,
    source_url: null,
    what_it_means:
      '"Reformular o financiamento" = mudar de onde vem o dinheiro do SUS. "Contratar rede privada" = o SUS paga particular. Tradução: menos investimento em hospital público, mais convênio com privado.',
    who_is_affected: 'Quem depende do SUS. Ou seja: a maioria do Brasil.',
    comparison: null,
    severity: 'high',
    sort_order: 4,
  },
  {
    area: 'saude',
    title: 'Prontuário Eletrônico Único',
    what_they_said:
      'Estabelecer o prontuário eletrônico único, vinculado ao CPF e integrado ao Gov.br.',
    source_name: 'Plano de governo',
    source_date: null,
    source_url: null,
    what_it_means:
      'Seus dados de saúde ficam num sistema único, ligado ao seu CPF, acessível pelo governo. Conveniente? Sim. Risco de vigilância? Também.',
    who_is_affected: 'Todo cidadão.',
    comparison: null,
    severity: 'medium',
    sort_order: 5,
  },
  {
    area: 'educacao',
    title: 'Voucher Escolar',
    what_they_said:
      "Criar 'voucher' para escolas particulares em locais em que faltam vagas em escolas públicas.",
    source_name: 'Plano de governo',
    source_date: null,
    source_url: null,
    what_it_means:
      'O dinheiro público que iria para a escola pública vai para a escola particular. A escola pública perde recurso. A particular ganha cliente. Ciclo de privatização gradual.',
    who_is_affected: 'Alunos da escola pública e seus pais.',
    comparison: null,
    severity: 'high',
    sort_order: 6,
  },
  {
    area: 'educacao',
    title: 'Escolas Cívico-Militares',
    what_they_said: 'Ampliar escolas cívico-militares.',
    source_name: 'Plano de governo',
    source_date: null,
    source_url: null,
    what_it_means:
      'Mais escolas sob comando militar. Uniforme, hierarquia, disciplina. Menos autonomia pedagógica.',
    who_is_affected: 'Alunos e professores.',
    comparison: null,
    severity: 'medium',
    sort_order: 7,
  },
  {
    area: 'judiciario',
    title: 'Anistia do 8 de Janeiro',
    what_they_said:
      'Anistiar os envolvidos no 8 de janeiro de 2023, incluindo os condenados pelo STF como seu pai, Jair Bolsonaro.',
    source_name: 'Plano de governo',
    source_date: null,
    source_url: null,
    what_it_means:
      'Quem invadiu os três poderes em 8/1/2023 sai da prisão. Jair Bolsonaro, condenado, é anistiado. O precedente: crime político comete-se sem consequência.',
    who_is_affected: 'A democracia. O estado de direito. Você.',
    comparison: null,
    severity: 'critical',
    sort_order: 8,
  },
  {
    area: 'judiciario',
    title: 'Limitar o STF',
    what_they_said:
      "Extinguir as competências criminais originárias do STF. Limitar as decisões monocráticas do STF. Indicar 'patriotas' para vagas no STF.",
    source_name: 'Plano de governo',
    source_date: null,
    source_url: null,
    what_it_means:
      'O STF perde poder para julgar crimes de autoridades. Decisões de um único ministro perdem força. Novos ministros são escolhidos por afinidade política, não por mérito jurídico.',
    who_is_affected: 'Quem depende do Judiciário para conter o Executivo.',
    comparison: null,
    severity: 'critical',
    sort_order: 9,
  },
  {
    area: 'judiciario',
    title: 'Acabar com a Reeleição',
    what_they_said: 'Acabar com a reeleição.',
    source_name: 'Plano de governo',
    source_date: null,
    source_url: null,
    what_it_means:
      'Ninguém pode ser reeleito para o mesmo cargo. Parece justo. Mas na prática: o presidente não pode se reeleger, então o vice (ou aliado) vira o candidato natural. Cria dinastias de outra forma.',
    who_is_affected: 'O sistema político como um todo.',
    comparison: null,
    severity: 'medium',
    sort_order: 10,
  },
  {
    area: 'economia',
    title: 'Cortar 10+ Ministérios',
    what_they_said:
      'Reduzir os ministérios, corte de cargos comissionados e enxugamento da máquina pública. (Forbes: "cortar ao menos dez ministérios.")',
    source_name: 'Plano de governo; Forbes, 10/2026',
    source_date: null,
    source_url: null,
    what_it_means:
      'Menos ministérios = menos políticas públicas específicas. Quem perde: ministérios ligados a saúde, educação, assistência social, meio ambiente. Quem ganha: "eficiência" (sem detalhar onde).',
    who_is_affected: 'Servidores públicos, programas sociais, políticas setoriais.',
    comparison: null,
    severity: 'high',
    sort_order: 11,
  },
  {
    area: 'economia',
    title: 'Suspender Reforma Tributária',
    what_they_said: 'Suspender por um ano a entrada em vigor da reforma tributária.',
    source_name: 'Plano de governo',
    source_date: null,
    source_url: null,
    what_it_means:
      'A reforma tributária (que simplifica impostos sobre consumo) fica parada por 1 ano. Empresas ganham prazo. Consumidor continua pagando o mesmo.',
    who_is_affected: 'Empresas (ganham), consumidores (perdem clareza).',
    comparison: null,
    severity: 'medium',
    sort_order: 12,
  },
  {
    area: 'economia',
    title: 'Retomar Desestatização',
    what_they_said: 'Retomar o Programa Nacional de Desestatização.',
    source_name: 'Plano de governo',
    source_date: null,
    source_url: null,
    what_it_means:
      'Privatizar estatais. O coordenador econômico (Adolfo Sachsida) descarta privatizar Petrobras, BB e Caixa "por enquanto", mas o programa está de volta.',
    who_is_affected:
      'Acionistas (ganham), trabalhadores das estatais (risco), usuários de serviços públicos (risco de aumento de preço).',
    comparison: null,
    severity: 'high',
    sort_order: 13,
  },
  {
    area: 'meio_ambiente',
    title: 'Eliminar Sobreposições Ibama/Funai/ICMBio',
    what_they_said: 'Eliminar superposições entre Ibama, Funai e ICMBio.',
    source_name: 'Plano de governo',
    source_date: null,
    source_url: null,
    what_it_means:
      'Três órgãos que fiscalizam meio ambiente e terras indígenas viram um. Menos fiscalização. Menos proteção. Mais abertura para agronegócio e mineração.',
    who_is_affected: 'Florestas, rios, povos indígenas, clima.',
    comparison: null,
    severity: 'high',
    sort_order: 14,
  },
];
