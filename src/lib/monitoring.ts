import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';
import { Platform } from 'react-native';
import { env, isBackendConfigured } from '@/lib/env';
import { safeUrl, scrubDeep } from '@/lib/monitoring.shared';

export { scrub } from '@/lib/monitoring.shared';

/**
 * Relatório de erros (Sentry). Só liga com EXPO_PUBLIC_SENTRY_DSN e backend
 * configurado; no modo local não manda nada.
 *
 * Anonimato vem antes do diagnóstico. Não vai usuário, IP (sendDefaultPii:
 * false), print nem árvore de tela, que mostrariam dado de outras pessoas.
 * Sem tracing e sem replay. Breadcrumb de console não vai; de rede vai só
 * método, host e caminho (a query do Supabase leva filtro, texto de checagem
 * etc.). Todo texto do evento passa pelo `scrub`, que troca e-mail,
 * telefone/CPF, CEP e UUID por marcadores.
 */
const DSN = env.sentryDsn;
let enabled = false;

export function initMonitoring(): void {
  if (!DSN || !isBackendConfigured) return;
  // o export estático do site roda este arquivo no Node, e lá não tem o que reportar
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

/** Envolve a raiz do app para pegar erro de renderização. Sem Sentry não muda nada. */
export function withMonitoring<P extends object>(Root: ComponentType<P>): ComponentType<P> {
  if (!enabled) return Root;
  // Sentry.wrap tipa as props como Record<string, unknown> e a raiz não tem props
  return Sentry.wrap(Root as unknown as ComponentType<Record<string, unknown>>) as unknown as ComponentType<P>;
}

/** Erro de teste, para conferir o painel (Perfil › Admin). */
export function sendTestError(): boolean {
  if (!enabled) return false;
  // Cada teste tem que ser único: erro igual ao anterior é descartado pela
  // deduplicação e no painel cairia no mesmo issue (só o contador sobe).
  const stamp = new Date().toLocaleString('pt-BR');
  Sentry.captureException(new Error(`Erro de teste do YvY (Perfil › Admin) — ${stamp}`), {
    fingerprint: ['yvy-test', stamp],
  });
  return true;
}

export const monitoringEnabled = () => enabled;

/** Problema esperado que a equipe precisa ver (sem dado pessoal). */
export function reportIssue(message: string, tags: Record<string, string> = {}): void {
  if (!enabled) return;
  Sentry.captureMessage(message, { level: 'warning', tags });
}
