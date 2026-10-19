import { isDark } from '@/ui/theme';

/**
 * Tokens de design do YvY.
 *
 * A paleta vem do docs/CONTEXT.md (seção 1.5). Não inventar cor solta: se
 * precisar de um tom, derive aqui e dê um nome que diga para que serve.
 *
 * A fonte é a do sistema. O documento pede Inter, mas num celular de R$ 800 no
 * 3G baixar duas TTF custa uns 200 KB e trava o primeiro frame. Se mudar, é
 * um ponto só: `font` aqui embaixo.
 */

const light = {
  // identidade
  primary: '#2D5A27', // verde-terra
  primarySoft: '#E8EEE7', // fundo de destaque derivado do primary
  accent: '#C45D3A', // terracota
  accentSoft: '#F7E9E3',

  // estado
  success: '#2ECC71',
  successSoft: '#E6F7EE',
  warning: '#F1C40F',
  warningSoft: '#FDF6DC',
  danger: '#E74C3C',
  neutral: '#8A8A85',

  // superficie
  bg: '#FAF8F5', // areia clara
  surface: '#FFFFFF',
  border: '#E6E2DB',

  // texto
  text: '#1C1B19',
  textMuted: '#6B6862',
  textOnPrimary: '#FFFFFF',

  // véu escuro sobre a tela (tour do primeiro acesso)
  scrim: 'rgba(20, 21, 19, 0.72)',
};

/**
 * Modo escuro, mesma família de cor. Verde e terracota ficam mais claros para
 * manter contraste no fundo escuro (texto branco no botão continua legível).
 */
const dark: typeof light = {
  primary: '#4F8F46',
  primarySoft: '#223020',
  accent: '#D9714D',
  accentSoft: '#3A251D',

  success: '#3DD17E',
  successSoft: '#18301F',
  warning: '#E5BC1E',
  warningSoft: '#352F14',
  danger: '#F06A5B',
  neutral: '#8F8C86',

  bg: '#141513',
  surface: '#1F211E',
  border: '#33362F',

  text: '#ECEAE5',
  textMuted: '#A6A39C',
  textOnPrimary: '#FFFFFF',

  scrim: 'rgba(0, 0, 0, 0.78)',
};

export const color = isDark ? dark : light;

/** Espaçamento em múltiplos de 4. Use só estes valores. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

/** Poucos tamanhos de texto, o contraste vem do peso. */
export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
} as const;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

/** Altura mínima de alvo de toque (acessibilidade). */
export const TOUCH = 44;
