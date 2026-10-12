import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { env } from '@/lib/env';
import { Txt } from '@/ui/Text';
import { isDark } from '@/ui/theme';

/**
 * Captcha (Cloudflare Turnstile) no site/PWA, desenhado direto na tela.
 * O script do Cloudflare só é baixado nas telas que pedem verificação
 * (entrar, cadastro, recuperar senha) — não pesa no resto do app.
 */
type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')));
    s.onerror = () => {
      loading = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function Captcha({ onToken }: { onToken: (token: string | null) => void }) {
  const box = useRef<View>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let id: string | null = null;
    let gone = false;
    loadTurnstile().then(
      (t) => {
        if (gone || !box.current) return;
        // No react-native-web a ref de View é o próprio elemento do DOM.
        id = t.render(box.current as unknown as HTMLElement, {
          sitekey: env.turnstileSiteKey,
          theme: isDark ? 'dark' : 'light',
          language: 'pt-br',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => {
            onToken(null);
            setFailed(true);
          },
        });
      },
      () => setFailed(true),
    );
    return () => {
      gone = true;
      if (id) window.turnstile?.remove(id);
    };
    // onToken muda a cada render; o widget é criado uma vez por montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <View ref={box} style={{ minHeight: 65, alignItems: 'center' }} />
      {failed ? (
        <Txt variant="small" tone="danger">
          Não deu para carregar a verificação. Confira a internet e tente de novo.
        </Txt>
      ) : null}
    </View>
  );
}
