import { isDark } from '@/ui/theme';

/**
 * Design tokens do Yvy.
 *
 * Paleta fixada em docs/CONTEXT.md secao 1.5. Nao inventar cor nova:
 * se precisar de um tom, derive aqui e de nome semantico.
 *
 * Tipografia: fonte do sistema. O doc especifica Inter, mas o principio
 * "performance > estetica" (secao 1.4) pesa mais num celular de R$ 800 em
 * 3G — baixar duas TTF custa ~200 KB e trava o primeiro frame. Trocar por
 * @expo-google-fonts/inter e um unico ponto: `font` abaixo.
 */

const light = {
  // identidade
  primary: '#2D5A27', // verde-terra: raiz, chao, crescimento
  primarySoft: '#E8EEE7', // fundo de destaque derivado do primary
  accent: '#C45D3A', // terracota: acao, urgencia, barro
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
};

/**
 * Modo escuro: mesma familia de cor, terra a noite. Verde e terracota sobem
 * de luminosidade para manter contraste no fundo escuro (texto branco em
 * botao continua legivel).
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
};

export const color = isDark ? dark : light;

/** Escala de espaco em multiplos de 4. Use so estes valores. */
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

/** Escala tipografica curta. Minimalismo = poucos tamanhos, muito contraste de peso. */
export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
} as const;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

/** Altura minima de alvo de toque (acessibilidade). */
export const TOUCH = 44;
