import type { Href } from 'expo-router';
import { FLAG } from '@/api/flags';
import { electionOver } from '@/lib/format';

export type TourContext = {
  /** membro confirmado: só ele tem as abas Ações e Base */
  member: boolean;
  pending: boolean;
  /** tour curto de quem acabou de ser confirmado */
  confirmed?: boolean;
  flags: Record<string, boolean>;
};

export type TourStep = {
  /** id do `<TourTarget>` na tela */
  id: string;
  /** sem rota: fica na tela atual (ícone de aba aparece em todas) */
  route?: Href;
  title: string;
  text: string;
  /** alvo é ícone da barra de abas: o destaque cobre também o rótulo */
  tab?: boolean;
  when?: (c: TourContext) => boolean;
};

const acoes = (c: TourContext) => c.member && Boolean(c.flags[FLAG.acoes]);
const base = (c: TourContext) => c.member && Boolean(c.flags[FLAG.feed]);

/**
 * Roteiro do tour depois do cadastro. Texto descreve o que a tela faz hoje:
 * mudou a tela, muda aqui (regra: texto que promete algo bate com o código).
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'home.top',
    route: '/(tabs)',
    title: 'Início',
    text: 'O que importa hoje fica aqui. Os outros membros só veem seu apelido e seu bairro. Nome, telefone, e-mail e endereço ficam com você.',
  },
  {
    id: 'home.pending',
    route: '/(tabs)',
    title: 'Falta quem te convidou confirmar',
    text: 'Enquanto isso, você usa o Início e o conteúdo público. Quando a pessoa confirmar, aparecem as abas Ações e Base, sem precisar fechar o app.',
    when: (c) => c.pending,
  },
  {
    id: 'home.top',
    route: '/(tabs)',
    title: 'Confirmado!',
    text: 'Quem te convidou confirmou que te conhece. Agora você tem as abas Ações e Base. Olha o que tem nelas.',
    when: (c) => Boolean(c.confirmed),
  },
  {
    id: 'home.propostas',
    route: '/(tabs)',
    title: electionOver() ? 'Plano do presidente eleito' : 'Propostas e planos',
    text: electionOver()
      ? 'O plano de governo que o presidente eleito entregou ao TSE antes da eleição. Tudo com o link da fonte.'
      : 'As propostas dos candidatos e os planos de governo que eles entregaram ao TSE. Tudo com o link da fonte.',
  },
  {
    id: 'home.checar',
    route: '/(tabs)',
    title: 'Checar fake news',
    text: 'Chegou algo estranho no grupo? Cole o texto ou mande o print. Se a equipe ainda não checou, a IA procura em sites de notícia e checagem. Esse resultado só você vê até a equipe conferir.',
    when: (c) => Boolean(c.flags[FLAG.checagem]),
  },
  {
    id: 'home.congresso',
    route: '/(tabs)',
    title: 'De olho em quem foi eleito',
    text: 'O que a Câmara e o Senado votaram, as consultas públicas abertas no Senado e quem foi eleito pelo seu estado.',
    when: (c) => Boolean(c.flags[FLAG.transparencia]),
  },
  {
    id: 'tab.acoes',
    title: 'Ações',
    text: 'Panfletagem, reunião, mutirão: o que a base faz na rua.',
    tab: true,
    when: acoes,
  },
  {
    id: 'acoes.map',
    route: '/(tabs)/acoes',
    title: 'Mapa',
    text: 'Cada ponto é uma ação marcada. A lista fica embaixo do mapa, e é nela que você confirma presença.',
    when: acoes,
  },
  {
    id: 'acoes.nova',
    route: '/(tabs)/acoes',
    title: 'Marcar uma ação',
    text: 'Diga o que vai ser, onde e quando. A base do bairro e da região vê no mapa.',
    when: acoes,
  },
  {
    id: 'acoes.region',
    route: '/(tabs)/acoes',
    title: 'Outras regiões',
    text: 'Troque para ver as ações das regiões que você segue, ou de uma cidade e bairro específicos.',
    when: acoes,
  },
  {
    id: 'tab.base',
    title: 'Base',
    text: 'O mural onde a base conversa.',
    tab: true,
    when: base,
  },
  {
    id: 'base.scope',
    route: '/(tabs)/base',
    title: 'Quem lê o seu post',
    text: 'Escolha: seu bairro, as cidades vizinhas, a região do país ou o Brasil todo. Dá para seguir até 5 outras regiões e ler o que postam lá.',
    when: base,
  },
  {
    id: 'base.composer',
    route: '/(tabs)/base',
    title: 'Postar',
    text: 'Escreva, ponha uma foto se quiser e publique. Viu um post que não devia estar ali? Toque em Denunciar e a moderação do bairro olha.',
    when: base,
  },
  {
    id: 'base.avisos',
    route: '/(tabs)/base',
    title: 'Avisos',
    text: 'Recados da coordenação e da moderação. Se quiser receber também por e-mail, ligue no Perfil.',
    when: base,
  },
  {
    id: 'tab.perfil',
    title: 'Perfil',
    text: 'Seus dados, avisos (no celular e por e-mail), tema escuro e privacidade.',
    tab: true,
  },
  {
    id: 'perfil.convidar',
    route: '/(tabs)/perfil',
    title: 'Convidar',
    text: 'Só entra quem é convidado, com o QRCode lido cara a cara. Aqui você vê quem convidou e confirma quem chegou. Se você ainda não pode convidar, quem te convidou ou a moderação do bairro pode liberar.',
    when: (c) => c.member && Boolean(c.flags[FLAG.convites]),
  },
  {
    id: 'perfil.tutorial',
    route: '/(tabs)/perfil',
    title: 'Ver de novo',
    text: 'Esse tour fica aqui, se quiser rever.',
  },
];

/**
 * Tour de quem acabou de ser confirmado: só os passos que a confirmação
 * liberou (valem para membro, não valiam para pendente).
 */
export function confirmedSteps(flags: Record<string, boolean>): TourStep[] {
  const after: TourContext = { member: true, pending: false, confirmed: true, flags };
  const before: TourContext = { member: false, pending: true, flags };
  return TOUR_STEPS.filter((st) => st.when && st.when(after) && !st.when(before));
}

/** Recado do fim do tour. Texto da equipe: mudou, muda aqui. */
export const TOUR_MISSION = {
  title: 'Por que o YvY existe',
  intro: [
    'A esquerda tem gente de sobra. O que falta é organização: grupo que some, planilha perdida, ação que ninguém fica sabendo.',
    'O YvY existe para organizar a base, bairro por bairro. E base organizada só funciona com confiança.',
  ],
  ask: 'Ajude a manter aqui APENAS camaradas de confiança:',
  rules: [
    'Convide só quem você conhece pessoalmente.',
    'Confirme só quem você sabe quem é. Na dúvida, recuse.',
    'Viu comportamento estranho? Denuncie.',
  ],
  close: 'Infiltrado estraga ação, expõe camarada e espalha boato. Cuidar da porta é tarefa de todo mundo.',
  button: 'Combinado, camarada',
};
