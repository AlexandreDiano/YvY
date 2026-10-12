import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { Button, Txt, YvyLogo, color, space } from '@/ui';
import { useAuth } from '@/features/auth/AuthProvider';

/**
 * Entrar com a digital (ou com a senha/padrão do celular).
 *
 * A sessão do Supabase já fica salva no aparelho depois do primeiro login com
 * e-mail e senha; a digital não troca a conta, ela tranca a tela. Ligado em
 * Perfil, o app pede a digital ao abrir e ao voltar depois de LOCK_AFTER_MS
 * fora. "Sair" pode só trancar (volta com a digital) ou sair de vez.
 *
 * Nada de senha nem token extra guardado: a preferência é só um "ligado" neste
 * aparelho. A trava é de tela — protege de quem pega o celular desbloqueado,
 * não substitui as regras do banco.
 */
const KEY = 'yvy:bio-lock';
const LOCK_AFTER_MS = 60_000;

type Ctx = {
  /** Celular tem digital/rosto cadastrado (ou senha de tela, como reserva). */
  available: boolean;
  enabled: boolean;
  setEnabled: (on: boolean) => Promise<boolean>;
  lockNow: () => void;
};

const BioContext = createContext<Ctx>({
  available: false,
  enabled: false,
  setEnabled: async () => false,
  lockNow: () => {},
});

export const useBiometricLock = () => useContext(BioContext);

async function prompt(message: string): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: message,
    cancelLabel: 'Cancelar',
    // Sem digital cadastrada ou com o sensor falhando, a senha do celular serve.
    disableDeviceFallback: false,
  });
  return r.success;
}

export function BiometricLockProvider({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const [checked, setChecked] = useState(Platform.OS === 'web');
  const [busy, setBusy] = useState(false);
  const leftAt = useRef<number | null>(null);
  // O próprio diálogo da digital tira o app do primeiro plano em alguns
  // Androids: sem isso, desbloquear trancaria de novo.
  const authenticating = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void (async () => {
      try {
        const [hw, enrolled, saved] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          AsyncStorage.getItem(KEY),
        ]);
        setAvailable(hw && enrolled);
        const on = saved === '1' && hw && enrolled;
        setEnabledState(on);
        if (on) setLocked(true);
      } finally {
        setChecked(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (authenticating.current) return;
      if (state === 'background') leftAt.current = Date.now();
      if (state === 'active' && leftAt.current !== null) {
        if (enabled && Date.now() - leftAt.current > LOCK_AFTER_MS) setLocked(true);
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const unlock = useCallback(async () => {
    setBusy(true);
    authenticating.current = true;
    try {
      if (await prompt('Entrar no YvY')) setLocked(false);
    } finally {
      authenticating.current = false;
      setBusy(false);
    }
  }, []);

  const showLock = enabled && locked && !!profile;

  // Abre o pedido da digital sozinho assim que a tela trava.
  useEffect(() => {
    if (showLock) void unlock();
  }, [showLock, unlock]);

  const setEnabled = useCallback(async (on: boolean) => {
    if (on) {
      authenticating.current = true;
      try {
        if (!(await prompt('Confirme para ligar a entrada com digital'))) return false;
      } finally {
        authenticating.current = false;
      }
    }
    await AsyncStorage.setItem(KEY, on ? '1' : '0');
    setEnabledState(on);
    return true;
  }, []);

  const lockNow = useCallback(() => setLocked(true), []);

  return (
    <BioContext.Provider value={{ available, enabled, setEnabled, lockNow }}>
      {children}
      {/* Antes de saber se a trava está ligada, não mostra a conta por um instante. */}
      {!checked && profile ? <View style={[StyleSheet.absoluteFill, s.cover]} /> : null}
      {showLock ? (
        <View style={[StyleSheet.absoluteFill, s.cover, s.center]}>
          <YvyLogo size={140} />
          <Txt variant="title" center>
            YvY trancado
          </Txt>
          <Txt variant="body" muted center>
            Use a digital (ou a senha do celular) para entrar.
          </Txt>
          <View style={s.actions}>
            <Button title="Entrar com digital" loading={busy} onPress={() => void unlock()} />
            <Button
              title="Entrar com e-mail e senha"
              kind="ghost"
              onPress={async () => {
                await signOut();
                setLocked(false);
                router.replace('/entrar');
              }}
            />
          </View>
        </View>
      ) : null}
    </BioContext.Provider>
  );
}

const s = StyleSheet.create({
  cover: { backgroundColor: color.bg, zIndex: 100, elevation: 100 },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.lg },
});
