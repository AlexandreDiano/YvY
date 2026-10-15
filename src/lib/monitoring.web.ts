import type { ComponentType } from 'react';
import { env, isBackendConfigured } from '@/lib/env';
import { safeUrl, scrubDeep } from '@/lib/monitoring.shared';

export { scrub } from '@/lib/monitoring.shared';

/**
 * Relatório de erros no site/PWA (ver monitoring.ts), com as mesmas regras de
 * anonimato do APK.
 *
 * O Sentry só carrega depois que o app abre (import dinâmico, arquivo
 * separado). O Metro não descarta código não usado e o SDK somava ~180 KB
 * comprimidos ao JS inicial, pesado demais para quem abre no 3G. Até ele
 * chegar os erros ficam numa fila.
 */
type SentryBrowser = typeof import('@sentry/browser');

let sdk: SentryBrowser | null = null;
let wanted = false;
const queue: unknown[] = [];

function onError(e: ErrorEvent) {
  if (!sdk) queue.push(e.error ?? new Error(e.message));
}
function onRejection(e: PromiseRejectionEvent) {
  if (!sdk) queue.push(e.reason);
}

async function load() {
  const S = await import('@sentry/browser');
  S.init({
    dsn: env.sentryDsn,
    // Bloqueador de anúncio barra *.sentry.io, então o relatório vai para o
    // próprio site (/monitoring) e a Vercel repassa ao Sentry (vercel.json).
    // Em localhost esse repasse não existe.
    tunnel: /^(localhost|127\.)/.test(location.hostname) ? undefined : '/monitoring',
    environment: __DEV__ ? 'development' : 'production',
    sendDefaultPii: false,
    defaultIntegrations: false,
    integrations: [
      S.globalHandlersIntegration(),
      S.linkedErrorsIntegration(),
      S.dedupeIntegration(),
      // sem console e sem DOM (texto de tela pode ter nome ou telefone)
      S.breadcrumbsIntegration({ console: false, dom: false, fetch: true, xhr: true, history: true }),
    ],
    tracesSampleRate: 0,
    maxBreadcrumbs: 30,
    beforeBreadcrumb(b) {
      if (b.category === 'fetch' || b.category === 'xhr') {
        return { ...b, data: { method: b.data?.method, url: safeUrl(b.data?.url), status_code: b.data?.status_code } };
      }
      return scrubDeep(b);
    },
    beforeSend(event) {
      delete event.user;
      delete event.request;
      delete event.server_name;
      return scrubDeep(event);
    },
  });
  sdk = S;
  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onRejection);
  for (const err of queue.splice(0)) S.captureException(err);
}

export function initMonitoring(): void {
  if (!env.sentryDsn || !isBackendConfigured) return;
  if (typeof window === 'undefined') return; // export estático no Node
  wanted = true;
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  const start = () => void load().catch(() => undefined);
  // depois que a página carregou e o navegador está livre
  const idle = () =>
    'requestIdleCallback' in window ? window.requestIdleCallback(start, { timeout: 5000 }) : setTimeout(start, 2000);
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}

/** Na web, erro de renderização já cai no handler global. */
export function withMonitoring<P extends object>(Root: ComponentType<P>): ComponentType<P> {
  return Root;
}

export function sendTestError(): boolean {
  if (!wanted) return false;
  // Cada teste tem que ser único: erro igual ao anterior é descartado pela
  // deduplicação e no painel cairia no mesmo issue (só o contador sobe).
  const stamp = new Date().toLocaleString('pt-BR');
  const err = new Error(`Erro de teste do YvY (Perfil › Admin) — ${stamp}`);
  if (sdk) sdk.captureException(err, { fingerprint: ['yvy-test', stamp] });
  else queue.push(err);
  return true;
}

export const monitoringEnabled = () => wanted;

/** Problema esperado que a equipe precisa ver (sem dado pessoal). */
export function reportIssue(message: string, tags: Record<string, string> = {}): void {
  if (!wanted) return;
  if (sdk) sdk.captureMessage(message, { level: 'warning', tags });
  else queue.push(new Error(`${message} ${JSON.stringify(tags)}`));
}
