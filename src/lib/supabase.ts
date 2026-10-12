import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import type { Database } from '@/lib/db.types';
import { env, isBackendConfigured } from '@/lib/env';

/**
 * Render estatico do export web roda em Node, sem `window`: o AsyncStorage
 * web quebra o build ali. Nesse passo nao ha sessao para guardar.
 */
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

/** `null` quando as chaves nao estao no .env — ver env.ts. */
export const supabase: SupabaseClient<Database> | null = isBackendConfigured
  ? createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: isServer ? undefined : AsyncStorage,
        autoRefreshToken: !isServer,
        persistSession: !isServer,
        // RN nao tem URL de callback de browser; o fluxo e OTP por telefone/e-mail.
        detectSessionInUrl: false,
      },
      global: { headers: { 'x-yvy-client': 'mobile' } },
    })
  : null;

/** Uso em api/*: garante cliente ou estoura erro legivel em vez de `null`. */
export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      'Backend não configurado. Copie .env.example para .env e preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}
