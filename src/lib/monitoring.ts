import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';
import { Platform } from 'react-native';
import { env, isBackendConfigured } from '@/lib/env';
import { safeUrl, scrubDeep } from '@/lib/monitoring.shared';

export { scrub } from '@/lib/monitoring.shared';

/**
 * Relatório de erros (Sentry, YVY-52). Liga só com EXPO_PUBLIC_SENTRY_DSN e
 * backend configurado — modo local não manda nada.
 *
 * Anonimato vem antes do diagnóstico:
 *  - sem usuário, sem IP (sendDefaultPii: false), sem print nem árvore de
 *    tela (mostrariam nome/telefone de eleitor);
 *  - sem tracing nem replay;
 *  - breadcrumb de console sai inteiro; de rede fica só método + host +
 *    caminho (a query do Supabase carrega filtro, texto de checagem etc.);
 *  - todo texto do evento passa por `scrub`: e-mail, telefone/CPF, CEP e
 *    UUID viram marcadores.
 */
const DSN = env.sentryDsn;
let enabled = false;

export function initMonitoring(): void {
  if (!DSN || !isBackendConfigured) return;
  // Export estático do site roda este arquivo no Node: lá não há o que reportar.
  if (Platform.OS === 'web' && typeof window === 'undefined') return;

  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 30,
    beforeBreadcrumb(b) {
      if (b.category === 'console') return null;
      if (b.category === 'fetch' || b.category === 'xhr' || b.category === 'http') {
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
  enabled = true;
}

/** Envolve a raiz do app (captura erro de renderização). Sem Sentry, nada muda. */
export function withMonitoring<P extends object>(Root: ComponentType<P>): ComponentType<P> {
  if (!enabled) return Root;
  // Sentry.wrap tipa as props como Record<string, unknown>; a raiz não tem props.
  return Sentry.wrap(Root as unknown as ComponentType<Record<string, unknown>>) as unknown as ComponentType<P>;
}

/** Erro de teste, para conferir o painel (Perfil › Admin). */
export function sendTestError(): boolean {
  if (!enabled) return false;
  // Cada teste único: erro igual ao anterior é descartado pela deduplicação
  // e, no painel, entraria no mesmo issue (só o contador sobe).
  const stamp = new Date().toLocaleString('pt-BR');
  Sentry.captureException(new Error(`Erro de teste do YvY (Perfil › Admin) — ${stamp}`), {
    fingerprint: ['yvy-test', stamp],
  });
  return true;
}

export const monitoringEnabled = () => enabled;
