/**
 * Variáveis de ambiente. Tudo que o app lê precisa do prefixo EXPO_PUBLIC_ e
 * vai dentro do bundle, então segredo nunca entra aqui (ver .env.example).
 */
const ELECTION_FALLBACK = '2026-10-25T08:00:00-03:00';

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  electionDate: new Date(process.env.EXPO_PUBLIC_ELECTION_DATE ?? ELECTION_FALLBACK),
  repoUrl: process.env.EXPO_PUBLIC_REPO_URL ?? 'https://github.com',
  /** Endereço do site/PWA (ex.: https://www.useyvy.app), sem barra no fim. */
  siteUrl: (process.env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/+$/, ''),
  /** Chave Pix para apoio (Perfil, só membros). Vazia, a seção some. */
  pixKey: process.env.EXPO_PUBLIC_PIX_KEY ?? '',
  /** Nome e cidade do recebedor no código Pix (sem acento; o banco mostra). */
  pixName: process.env.EXPO_PUBLIC_PIX_NAME ?? 'YvY',
  pixCity: process.env.EXPO_PUBLIC_PIX_CITY ?? 'BRASIL',
  /**
   * Cloudflare Turnstile (captcha de cadastro, login e recuperar senha). A chave
   * de site é pública. Vazia, fica sem captcha. Ver src/features/auth/useCaptcha.tsx.
   */
  turnstileSiteKey: process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '',
  /** Sentry (relatório de erros, src/lib/monitoring.ts). O DSN é público mesmo. */
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  /** Instagram de contato no rodapé do Perfil (sem @). */
  instagram: process.env.EXPO_PUBLIC_INSTAGRAM ?? 'dianooxz',
};

/**
 * Sem as chaves do Supabase o app roda em modo local: o conteúdo público
 * (cards e checagem) sai do seed embutido e o resto fica desligado com aviso
 * na tela. Dá para rodar `npm start` antes de existir backend.
 */
export const isBackendConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
