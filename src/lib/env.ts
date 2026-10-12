/**
 * Variaveis de ambiente. Tudo que o app le precisa do prefixo EXPO_PUBLIC_
 * (vai dentro do bundle — nunca por segredo aqui; ver .env.example).
 */
const ELECTION_FALLBACK = '2026-10-25T08:00:00-03:00';

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  electionDate: new Date(process.env.EXPO_PUBLIC_ELECTION_DATE ?? ELECTION_FALLBACK),
  repoUrl: process.env.EXPO_PUBLIC_REPO_URL ?? 'https://github.com',
};

/**
 * Sem chaves do Supabase o app roda em modo local: conteudo publico
 * (cards e checagem) sai do seed embutido, e o resto fica desabilitado com
 * aviso na tela. Serve para rodar `npm start` antes de existir backend.
 */
export const isBackendConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
