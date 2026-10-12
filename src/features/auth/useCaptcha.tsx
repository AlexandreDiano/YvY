import { useCallback, useState } from 'react';
import { env, isBackendConfigured } from '@/lib/env';
import { Captcha } from '@/ui/Captcha';

/**
 * Captcha das telas de conta (cadastro, entrar, recuperar senha).
 *
 * Só existe com EXPO_PUBLIC_TURNSTILE_SITE_KEY e backend: sem chave, ou no
 * modo local, `widget` é null, `ready` é true e tudo funciona como antes.
 * O token vale uma vez e por ~5 min: chamar `reset()` depois de CADA
 * tentativa (deu certo ou não) — remonta o widget e gera outro.
 */
export function useCaptcha() {
  const required = Boolean(env.turnstileSiteKey) && isBackendConfigured;
  const [token, setToken] = useState<string | null>(null);
  const [gen, setGen] = useState(0);

  const reset = useCallback(() => {
    setToken(null);
    setGen((g) => g + 1);
  }, []);

  return {
    /** Token para mandar ao Supabase (undefined sem captcha). */
    token: token ?? undefined,
    /** Pode enviar: sem captcha, ou com token na mão. */
    ready: !required || Boolean(token),
    reset,
    widget: required ? <Captcha key={gen} onToken={setToken} /> : null,
  };
}
