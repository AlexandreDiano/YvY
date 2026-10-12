-- Yvy — cards de propostas.
--
-- GERADO por scripts/gen-seed-sql.mjs. Não editar à mão: mexa em
-- src/data/*.ts e rode o script de novo.
--
-- Conteúdo transcrito literalmente da seção 6.1 de docs/CONTEXT.md,
-- com fonte e data. Mudança de conteúdo é decisão editorial.


insert into proposal_cards
  (area, title, what_they_said, source_name, source_date, source_url,
   what_it_means, who_is_affected, comparison, severity, sort_order)
values
  ('trabalho', 'PEC 12: Pagamento por Hora', 'Flexibilizar a CLT para permitir o pagamento por hora (PEC 12/2026).', 'Plano de governo, setembro/2026', date '2026-09-01', null,
   'O trabalhador só recebe pelas horas efetivamente trabalhadas. Na escala 5×2, o salário mínimo pode cair de R$ 1.518 para R$ 1.297. Férias, 13º e FGTS continuam, mas a base de cálculo muda.', 'Todo trabalhador CLT, especialmente quem faz escala 6x1 ou 5x2. Você, seu filho, seu vizinho.', 'Lula propõe o fim da escala 6x1 (PEC em tramitação no Senado). Flávio propõe o oposto: pagamento por hora, que reduz a renda de quem trabalha 6 dias.', 'critical', 1),
  ('trabalho', 'Fim da 6x1? Não.', 'A campanha de Flávio chama o debate da escala 6x1 de "tentativa de mudar o foco". O plano de governo NÃO propõe acabar com a 6x1.', 'R7, 27/08/2026', date '2026-08-27', null,
   'Enquanto Lula promete fim da 6x1, Flávio quer o contrário: pagamento por hora, que na prática reduz a renda de quem trabalha 6 dias.', 'Trabalhadores de comércio, serviços, saúde, educação.', null, 'high', 2),
  ('trabalho', 'Contrato Jovem (18–24 anos)', 'Criar contratos de trabalho para jovens de 18 a 24 anos em busca do primeiro emprego.', 'Plano de governo', null, null,
   'Contrato com regras diferentes da CLT para jovens. Na prática: salário menor, menos direitos, mais fácil demitir.', 'Jovens que entram no mercado de trabalho.', null, 'medium', 3),
  ('saude', '"Plano Real da Saúde"', 'Reformular o SUS, alterando o financiamento e valorizando os profissionais de saúde. Contratar serviços e exames na rede privada nos horários ociosos.', 'Plano de governo', null, null,
   '"Reformular o financiamento" = mudar de onde vem o dinheiro do SUS. "Contratar rede privada" = o SUS paga particular. Tradução: menos investimento em hospital público, mais convênio com privado.', 'Quem depende do SUS. Ou seja: a maioria do Brasil.', null, 'high', 4),
  ('saude', 'Prontuário Eletrônico Único', 'Estabelecer o prontuário eletrônico único, vinculado ao CPF e integrado ao Gov.br.', 'Plano de governo', null, null,
   'Seus dados de saúde ficam num sistema único, ligado ao seu CPF, acessível pelo governo. Conveniente? Sim. Risco de vigilância? Também.', 'Todo cidadão.', null, 'medium', 5),
  ('educacao', 'Voucher Escolar', 'Criar ''voucher'' para escolas particulares em locais em que faltam vagas em escolas públicas.', 'Plano de governo', null, null,
   'O dinheiro público que iria para a escola pública vai para a escola particular. A escola pública perde recurso. A particular ganha cliente. Ciclo de privatização gradual.', 'Alunos da escola pública e seus pais.', null, 'high', 6),
  ('educacao', 'Escolas Cívico-Militares', 'Ampliar escolas cívico-militares.', 'Plano de governo', null, null,
   'Mais escolas sob comando militar. Uniforme, hierarquia, disciplina. Menos autonomia pedagógica.', 'Alunos e professores.', null, 'medium', 7),
  ('judiciario', 'Anistia do 8 de Janeiro', 'Anistiar os envolvidos no 8 de janeiro de 2023, incluindo os condenados pelo STF como seu pai, Jair Bolsonaro.', 'Plano de governo', null, null,
   'Quem invadiu os três poderes em 8/1/2023 sai da prisão. Jair Bolsonaro, condenado, é anistiado. O precedente: crime político comete-se sem consequência.', 'A democracia. O estado de direito. Você.', null, 'critical', 8),
  ('judiciario', 'Limitar o STF', 'Extinguir as competências criminais originárias do STF. Limitar as decisões monocráticas do STF. Indicar ''patriotas'' para vagas no STF.', 'Plano de governo', null, null,
   'O STF perde poder para julgar crimes de autoridades. Decisões de um único ministro perdem força. Novos ministros são escolhidos por afinidade política, não por mérito jurídico.', 'Quem depende do Judiciário para conter o Executivo.', null, 'critical', 9),
  ('judiciario', 'Acabar com a Reeleição', 'Acabar com a reeleição.', 'Plano de governo', null, null,
   'Ninguém pode ser reeleito para o mesmo cargo. Parece justo. Mas na prática: o presidente não pode se reeleger, então o vice (ou aliado) vira o candidato natural. Cria dinastias de outra forma.', 'O sistema político como um todo.', null, 'medium', 10),
  ('economia', 'Cortar 10+ Ministérios', 'Reduzir os ministérios, corte de cargos comissionados e enxugamento da máquina pública. (Forbes: "cortar ao menos dez ministérios.")', 'Plano de governo; Forbes, 10/2026', null, null,
   'Menos ministérios = menos políticas públicas específicas. Quem perde: ministérios ligados a saúde, educação, assistência social, meio ambiente. Quem ganha: "eficiência" (sem detalhar onde).', 'Servidores públicos, programas sociais, políticas setoriais.', null, 'high', 11),
  ('economia', 'Suspender Reforma Tributária', 'Suspender por um ano a entrada em vigor da reforma tributária.', 'Plano de governo', null, null,
   'A reforma tributária (que simplifica impostos sobre consumo) fica parada por 1 ano. Empresas ganham prazo. Consumidor continua pagando o mesmo.', 'Empresas (ganham), consumidores (perdem clareza).', null, 'medium', 12),
  ('economia', 'Retomar Desestatização', 'Retomar o Programa Nacional de Desestatização.', 'Plano de governo', null, null,
   'Privatizar estatais. O coordenador econômico (Adolfo Sachsida) descarta privatizar Petrobras, BB e Caixa "por enquanto", mas o programa está de volta.', 'Acionistas (ganham), trabalhadores das estatais (risco), usuários de serviços públicos (risco de aumento de preço).', null, 'high', 13),
  ('meio_ambiente', 'Eliminar Sobreposições Ibama/Funai/ICMBio', 'Eliminar superposições entre Ibama, Funai e ICMBio.', 'Plano de governo', null, null,
   'Três órgãos que fiscalizam meio ambiente e terras indígenas viram um. Menos fiscalização. Menos proteção. Mais abertura para agronegócio e mineração.', 'Florestas, rios, povos indígenas, clima.', null, 'high', 14)
on conflict do nothing;
