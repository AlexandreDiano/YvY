import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { env } from '@/lib/env';
import { reportIssue } from '@/lib/monitoring';
import { Txt } from '@/ui/Text';
import { isDark } from '@/ui/theme';

/**
 * Captcha (Cloudflare Turnstile) no site/PWA, desenhado direto na tela. O
 * script da Cloudflare só baixa nas telas que pedem verificação (entrar,
 * cadastro, recuperar senha), então não pesa no resto do app.
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

/** Aberto como app instalado (PWA), não como aba do navegador. */
function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone);
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
  // Motivo da falha, mostrado na tela e mandado ao Sentry. 'script' quer dizer
  // que o arquivo da Cloudflare não carregou; número é código de erro do Turnstile.
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let id: string | null = null;
    let gone = false;
    loadTurnstile().then(
      (t) => {
        if (gone || !box.current) return;
        // no react-native-web a ref de View é o próprio elemento do DOM
        id = t.render(box.current as unknown as HTMLElement, {
          sitekey: env.turnstileSiteKey,
          theme: isDark ? 'dark' : 'light',
          language: 'pt-br',
          // erro passageiro, o próprio Turnstile tenta de novo; token vencido
          // renova sozinho
          retry: 'auto',
          'refresh-expired': 'auto',
          callback: (token: string) => {
            setFailed(null);
            onToken(token);
          },
          'expired-callback': () => onToken(null),
          'error-callback': (code: string) => {
            onToken(null);
            setFailed(String(code || 'desconhecido'));
            // domínio do site (não é dado pessoal). 110200 é domínio fora da lista
            // de hostnames do widget no Cloudflare
            reportIssue('Turnstile falhou', {
              code: String(code || ''),
              standalone: String(isStandalone()),
              host: window.location.hostname,
            });
          },
        });
      },
      () => {
        setFailed('script');
        reportIssue('Turnstile: script não carregou', { standalone: String(isStandalone()), host: window.location.hostname });
      },
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
          {failed === 'script'
            ? 'Não deu para carregar a verificação da Cloudflare. Confira a internet ou se há bloqueador de anúncios.'
            : failed === '110200'
              ? `Este endereço (${window.location.hostname}) não está autorizado na verificação. Abra pelo endereço oficial do YvY e instale de novo a partir dele.`
              : `A verificação falhou (código ${failed}). Tente de novo em alguns segundos.`}
        </Txt>
      ) : null}
    </View>
  );
}
