/**
 * Erro do Supabase (Auth, PostgREST, Storage, rede) em português. As RPCs do
 * Yvy já levantam a mensagem em português (raise exception … P0001) e passam
 * como vieram; o resto, que o Supabase escreve em inglês, vira frase nossa.
 * Nada de mensagem em inglês na tela.
 */
type Raw = { code?: string; status?: number; message?: string; error_description?: string; name?: string };

const AUTH: Record<string, string> = {
  email_exists: 'Esse e-mail já é de outra conta.',
  user_already_exists: 'Esse e-mail já é de outra conta.',
  email_address_invalid: 'Esse e-mail não é aceito. Confira o endereço.',
  email_not_confirmed: 'Confirme o e-mail antes de entrar. O link está na sua caixa de entrada.',
  invalid_credentials: 'E-mail ou senha não conferem.',
  same_password: 'A senha nova é igual à atual. Escolha outra.',
  weak_password: 'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.',
  captcha_failed: 'A verificação de segurança falhou. Tente de novo.',
  over_email_send_rate_limit: 'Muitos e-mails pedidos agora. Espere alguns minutos e tente de novo.',
  over_request_rate_limit: 'Muitos pedidos agora. Tente de novo em alguns minutos.',
  over_sms_send_rate_limit: 'Muitos pedidos agora. Tente de novo em alguns minutos.',
  session_not_found: 'Sua sessão expirou. Entre de novo.',
  session_expired: 'Sua sessão expirou. Entre de novo.',
  refresh_token_not_found: 'Sua sessão expirou. Entre de novo.',
  refresh_token_already_used: 'Sua sessão expirou. Entre de novo.',
  reauthentication_needed: 'Confirme sua senha atual antes de mudar isso.',
  reauthentication_not_valid: 'O código de confirmação não confere.',
  otp_expired: 'O link expirou. Peça um novo.',
  signup_disabled: 'O cadastro está fechado no momento.',
  user_banned: 'Esta conta está suspensa.',
  user_not_found: 'Conta não encontrada.',
  email_address_not_authorized: 'Não deu para mandar e-mail para esse endereço.',
  validation_failed: 'Algum dado não está certo. Confira e tente de novo.',
};

const POSTGRES: Record<string, string> = {
  '42501': 'Você não tem permissão para fazer isso.',
  '23505': 'Isso já existe.',
  '23503': 'Esse item não existe mais.',
  '23514': 'Algum dado não está certo. Confira e tente de novo.',
  '22P02': 'Algum dado não está certo. Confira e tente de novo.',
  PGRST301: 'Sua sessão expirou. Entre de novo.',
  PGRST116: 'Não encontrado.',
};

const BY_TEXT: [RegExp, string][] = [
  [/failed to fetch|network ?request failed|networkerror|load failed|fetch failed/i, 'Sem conexão com o servidor. Confira a internet e tente de novo.'],
  [/error sending .*email|sending (confirmation|recovery|magic link|email change)/i, 'Não conseguimos mandar o e-mail agora. Tente de novo mais tarde.'],
  [/row-level security|permission denied/i, 'Você não tem permissão para fazer isso.'],
  [/jwt expired|invalid jwt|refresh token/i, 'Sua sessão expirou. Entre de novo.'],
  [/rate limit|too many requests/i, 'Muitos pedidos agora. Tente de novo em alguns minutos.'],
  [/you can only request this after/i, 'Espere alguns segundos antes de pedir de novo.'],
  [/password should be at least|password is too weak/i, AUTH.weak_password!],
  [/timeout|timed out/i, 'O servidor demorou para responder. Tente de novo.'],
];

/** Palavras que denunciam texto em inglês vindo do servidor. */
const ENGLISH = /\b(the|is|are|not|failed|error|invalid|unable|cannot|could|should|must|already|request|found|denied|expired|unexpected)\b/i;

export function ptMessage(err: unknown, fallback = 'Algo deu errado. Tente de novo.'): string {
  if (!err) return fallback;
  const e = (typeof err === 'string' ? { message: err } : err) as Raw;
  const msg = (e.message ?? e.error_description ?? '').trim();
  if (e.code && AUTH[e.code]) return AUTH[e.code]!;
  if (e.code && POSTGRES[e.code]) return POSTGRES[e.code]!;
  for (const [re, pt] of BY_TEXT) if (re.test(msg)) return pt;
  if (e.status === 429) return 'Muitos pedidos agora. Tente de novo em alguns minutos.';
  if (e.status && e.status >= 500) return 'O servidor teve um problema. Tente de novo em alguns minutos.';
  // RPC nossa (P0001) e erro já escrito por nós passam como estão
  if (msg && !ENGLISH.test(msg)) return msg;
  return fallback;
}

/** Error com a mensagem em português, para `throw` nas funções de API. */
export function ptError(err: unknown, fallback?: string): Error {
  const out = new Error(ptMessage(err, fallback)) as Error & { cause?: unknown; code?: string; status?: number };
  // quem chama ainda decide pelo código (ex.: email_not_confirmed no login)
  const e = (err ?? {}) as Raw;
  out.cause = err;
  if (e.code) out.code = e.code;
  if (e.status) out.status = e.status;
  return out;
}
