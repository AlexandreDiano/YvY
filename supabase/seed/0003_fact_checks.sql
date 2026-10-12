-- Yvy — base de checagem.
--
-- GERADO por scripts/gen-seed-sql.mjs. Não editar à mão: mexa em
-- src/data/*.ts e rode o script de novo.
--
-- Conteúdo transcrito literalmente da seção 6.2 de docs/CONTEXT.md,
-- com fonte e data. Mudança de conteúdo é decisão editorial.


insert into fact_checks (claim_text, result, explanation, source_name, source_url)
values
  ('Flávio vai privatizar a Petrobras', 'half_true', 'O coordenador econômico descarta privatizar Petrobras, BB e Caixa "por enquanto", mas o programa de desestatização está de volta.', 'Forbes, 10/2026', null),
  ('Flávio vai cortar o Bolsa Família', 'false', 'O plano de governo diz "manter programas assistenciais existentes". O que muda é o piso do BPC (só inflação, sem aumento real).', 'Plano de governo', null),
  ('Lula quer aumentar impostos', 'half_true', 'Lula propõe manter o arcabouço fiscal e fazer concessões em infraestrutura. Não há proposta de novo imposto, mas a reforma tributária (suspensa por Flávio) muda a alíquota de consumo.', 'Invest News, 10/2026', null),
  ('Flávio vai acabar com o SUS', 'exaggeration', 'Ele propõe "reformular o financiamento" e contratar rede privada. Não é extinção, mas é mudança estrutural que reduz o papel do SUS.', 'Plano de governo', null),
  ('Lula é responsável pela inflação', 'half_true', 'A inflação é multifatorial (ciclo global, câmbio, energia). Lula mantém o arcabouço fiscal, mas o BC controla a taxa de juros. Culpar só o governo é simplificar.', 'Banco Central, 2026', null),
  ('Flávio vai anistiar só o pai', 'false', 'A anistia proposta cobre TODOS os envolvidos no 8 de janeiro, incluindo condenados pelo STF. Jair Bolsonaro é um deles, mas não o único.', 'Plano de governo', null)
on conflict do nothing;
