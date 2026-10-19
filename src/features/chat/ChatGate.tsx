import type { ReactNode } from 'react';
import { FLAG } from '@/api/flags';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { EmptyState, Loading, Screen } from '@/ui';

/** Conversas só para membro confirmado, com servidor e com a flag ligada. */
export function ChatGate({ children }: { children: ReactNode }) {
  const { ready, isBaseMember, flags } = useAuth();
  if (!ready) return <Loading />;
  if (!supabase) {
    return (
      <Screen>
        <EmptyState title="Conversas precisam do servidor" detail="Neste modo de teste local não há como entregar mensagens." />
      </Screen>
    );
  }
  if (!isBaseMember) {
    return (
      <Screen>
        <EmptyState title="Só para membro confirmado" detail="Quando quem te convidou confirmar sua entrada, as conversas abrem aqui." />
      </Screen>
    );
  }
  if (!flags[FLAG.chat]) {
    return (
      <Screen>
        <EmptyState title="Conversas ainda não abriram" detail="A equipe liga esta parte em breve." />
      </Screen>
    );
  }
  return <>{children}</>;
}
