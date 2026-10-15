import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import type { Database } from '@/lib/db.types';
import { env, isBackendConfigured } from '@/lib/env';

/**
 * O render estático do export web roda no Node, sem `window`, e o AsyncStorage
 * web quebra o build ali. Nesse passo não tem sessão para guardar mesmo.
 */
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

/** `null` quando as chaves não estão no .env (ver env.ts). */
export const supabase: SupabaseClient<Database> | null = isBackendConfigured
  ? createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: isServer ? undefined : AsyncStorage,
        autoRefreshToken: !isServer,
        persistSession: !isServer,
        // RN não tem URL de callback de navegador, o fluxo é por código no e-mail
        detectSessionInUrl: false,
      },
      global: { headers: { 'x-yvy-client': 'mobile' } },
    })
  : null;

/** Para os api/*: devolve o cliente ou estoura um erro legível em vez de `null`. */
export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      'Backend não configurado. Copie .env.example para .env e preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}
