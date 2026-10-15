import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_FLAGS, loadFlags } from '@/api/flags';
import type { MembershipStatus, Profile, UserRole } from '@/lib/db.types';
import { isBackendConfigured } from '@/lib/env';
import { suggestDisplayName } from '@/lib/format';
import { supabase } from '@/lib/supabase';

/**
 * Sessão do app.
 *
 * O QRCode vem antes da conta. Sem convite presencial válido ninguém se
 * cadastra, só navega pelo conteúdo público (propostas e checagem), que não
 * pede sessão. Quem tem convite cria conta com e-mail e senha e entra como
 * membro (role 'militant') pendente até quem convidou confirmar.
 *
 * Tem dois modos. `backend` usa Supabase Auth (e-mail/senha) e a RPC
 * redeem_invite. `local` é quando não tem chave no .env: o perfil fica no
 * AsyncStorage, dá para navegar no app antes de existir backend e nada sai do
 * aparelho.
 */

const LOCAL_KEY = 'yvy:localProfile';

export type SignUpInput = {
  email: string;
  password: string;
  fullName: string;
  displayName?: string;
  phone?: string;
  cep: string;
  neighborhood: string;
  city: string;
  state: string;
  locationPrecision?: number;
  acceptedTerms: boolean;
  /** Consentimento separado para dado de participação política (LGPD art. 11). */
  sensitiveConsent: boolean;
  /** Token do captcha (Turnstile), se o captcha estiver ligado. Vale uma vez. */
  captchaToken?: string;
};

type Ctx = {
  ready: boolean;
  mode: 'backend' | 'local';
  profile: Profile | null;
  role: UserRole | null;
  membership: MembershipStatus | null;
  /** Membro confirmado por quem convidou. É o que libera a área da base. */
  isBaseMember: boolean;
  isModerator: boolean;
  isAdmin: boolean;
  flags: Record<string, boolean>;
  /**
   * Admin vendo o app como visitante. Só muda a interface, as requisições
   * continuam saindo com a sessão do admin. Fica só em memória de propósito,
   * fechou o app voltou ao normal.
   */
  visitorView: boolean;
  /** Admin de verdade, mesmo com a visão de visitante ligada. */
  canPreviewVisitor: boolean;
  setVisitorView: (on: boolean) => void;
  /** 'email_pending': a conta existe mas falta confirmar o e-mail (o convite é usado no 1º login). */
  signUpWithInvite: (claim: string, input: SignUpInput) => Promise<MembershipStatus | 'email_pending'>;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  /** Manda o código de recuperação para o e-mail (template "Reset Password" com {{ .Token }}). */
  requestPasswordReset: (email: string, captchaToken?: string) => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

/**
 * Cadastro esperando a confirmação do e-mail. Fica só neste aparelho, sem
 * senha, e o convite é resgatado no primeiro login depois de confirmar (a
 * reserva feita no scan vale 24h, ver claimInvite em src/api/invites.ts). Sem
 * isso, com "Confirm email" ligado no Supabase, o cadastro não teria sessão
 * para usar o convite.
 */
const PENDING_KEY = 'yvy:pending-signup';
type PendingSignup = { email: string; claim: string; input: Omit<SignUpInput, 'password'> };

/** Erro do captcha (Turnstile) vindo do Supabase Auth. */
function isCaptchaError(e: { code?: string; message?: string }): boolean {
  return e.code === 'captcha_failed' || /captcha/i.test(e.message ?? '');
}

/** Troca o erro de captcha por uma frase em português. Os outros passam como estão. */
function captchaError<E extends { code?: string; message?: string }>(e: E): E | Error {
  return isCaptchaError(e) ? new Error('A verificação "não sou robô" falhou ou venceu. Faça de novo e tente outra vez.') : e;
}

async function redeem(client: NonNullable<typeof supabase>, claim: string, input: Omit<SignUpInput, 'password'>) {
  const { data, error } = await client.rpc('redeem_invite', {
    p_claim: claim,
    p_full_name: input.fullName.trim(),
    p_display_name: input.displayName?.trim() || suggestDisplayName(input.fullName) || 'Camarada',
    p_phone: input.phone ?? null,
    p_cep: input.cep,
    p_neighborhood: input.neighborhood,
    p_city: input.city,
    p_state: input.state,
    p_location_precision: input.locationPrecision ?? 3,
    p_sensitive_consent: input.sensitiveConsent === true,
  });
  if (error) throw error;
  return (data?.[0]?.membership_status ?? 'pending') as MembershipStatus;
}

function localProfile(input: SignUpInput, membership: MembershipStatus): Profile {
  const now = new Date().toISOString();
  return {
    id: `local-${Math.random().toString(36).slice(2, 10)}`,
    role: 'militant',
    membership_status: membership,
    full_name: input.fullName.trim() || null,
    display_name: input.displayName?.trim() || suggestDisplayName(input.fullName) || 'Camarada',
    phone: input.phone ?? null,
    email: input.email,
    cep: input.cep,
    neighborhood: input.neighborhood,
    city: input.city,
    state: input.state,
    location_precision: input.locationPrecision ?? 3,
    avatar_url: null,
    show_avatar: false,
    is_active: true,
    invited_by: null,
    notify_actions: true,
    notify_feed: false,
    terms_accepted_at: input.acceptedTerms ? now : null,
    sensitive_consent_at: input.sensitiveConsent ? now : null,
    created_at: now,
    updated_at: now,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = isBackendConfigured ? 'backend' : 'local';
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({ ...DEFAULT_FLAGS });
  const [visitorView, setVisitorView] = useState(false);

  const loadLocal = useCallback(async () => {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    setProfile(raw ? (JSON.parse(raw) as Profile) : null);
  }, []);

  const loadRemote = useCallback(async () => {
    const client = supabase!;
    const { data: sess } = await client.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    let res = await client.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (!res.data) {
      // primeiro login depois de confirmar o e-mail: usa o convite guardado
      const raw = await AsyncStorage.getItem(PENDING_KEY);
      const pending = raw ? (JSON.parse(raw) as PendingSignup) : null;
      if (pending && pending.email === sess.session?.user.email?.toLowerCase()) {
        try {
          await redeem(client, pending.claim, pending.input);
        } finally {
          await AsyncStorage.removeItem(PENDING_KEY);
        }
        res = await client.from('profiles').select('*').eq('id', uid).maybeSingle();
      }
    }
    setProfile((res.data as Profile | null) ?? null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (mode === 'backend') await loadRemote();
      else await loadLocal();
      setFlags(await loadFlags());
    } finally {
      setReady(true);
    }
  }, [mode, loadLocal, loadRemote]);

  useEffect(() => {
    void refresh();
    if (mode !== 'backend' || !supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [mode, refresh]);

  const signUpWithInvite = useCallback(
    async (claim: string, input: SignUpInput): Promise<MembershipStatus | 'email_pending'> => {
      if (!input.acceptedTerms) throw new Error('É preciso aceitar os termos para continuar.');
      if (!claim) throw new Error('Sem convite não é possível criar conta.');

      if (mode === 'local') {
        // Sem backend não tem convite para validar nem quem confirmar. Entra
        // 'active' de propósito, senão as abas da base ficariam inacessíveis
        // e não teria o que testar.
        const next = localProfile(input, 'active');
        await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        setProfile(next);
        return 'active';
      }

      const client = supabase!;
      const signUp = await client.auth.signUp({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        options: { captchaToken: input.captchaToken },
      });
      if (signUp.error) throw captchaError(signUp.error);
      // senha e token do captcha nunca vão para o cadastro guardado no aparelho
      const { password: _omit, captchaToken: _token, ...keep } = input;
      if (!signUp.data.session) {
        // "Confirm email" ligado: guarda o cadastro e usa o convite no 1º login
        const pending: PendingSignup = { email: input.email.trim().toLowerCase(), claim, input: keep };
        await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        return 'email_pending';
      }

      let status: MembershipStatus;
      try {
        status = await redeem(client, claim, keep);
      } catch (error) {
        // conta criada mas convite recusado, não deixa usuário órfão logado
        await client.auth.signOut();
        throw error;
      }
      await refresh();
      return status;
    },
    [mode, refresh],
  );

  const requestPasswordReset = useCallback(
    async (email: string, captchaToken?: string) => {
      if (mode === 'local') throw new Error('Recuperar senha exige backend configurado.');
      const { error } = await supabase!.auth.resetPasswordForEmail(email.trim().toLowerCase(), { captchaToken });
      if (error && isCaptchaError(error)) throw captchaError(error);
      // Limite de envio é o único erro que vale mostrar. "E-mail não existe" não
      // é dito por quem chama (a tela responde igual nos dois casos).
      if (error && error.status === 429) throw new Error('Muitos pedidos agora. Tente de novo em alguns minutos.');
    },
    [mode],
  );

  const resetPassword = useCallback(
    async (email: string, code: string, password: string) => {
      if (mode === 'local') throw new Error('Recuperar senha exige backend configurado.');
      const addr = email.trim().toLowerCase();
      // O código só vale uma vez. Se a troca de senha falhou depois de conferir
      // (senha igual à antiga, por exemplo), a sessão de recuperação já existe e
      // a nova tentativa vai direto pro updateUser.
      const { data: cur } = await supabase!.auth.getSession();
      if (cur.session?.user.email?.toLowerCase() !== addr) {
        const { error } = await supabase!.auth.verifyOtp({ email: addr, token: code.replace(/\D+/g, ''), type: 'recovery' });
        if (error) throw new Error('Código inválido ou vencido. Peça outro.');
      }
      const { error: e2 } = await supabase!.auth.updateUser({ password });
      if (e2) {
        if (e2.code === 'same_password') throw new Error('A senha nova precisa ser diferente da antiga.');
        if (e2.code === 'weak_password') throw new Error('Senha fraca. Use uma mais longa, com letras e números.');
        throw e2;
      }
      await refresh();
    },
    [mode, refresh],
  );

  const signIn = useCallback(
    async (email: string, password: string, captchaToken?: string) => {
      if (mode === 'local') throw new Error('Entrar com e-mail exige backend configurado.');
      const { error } = await supabase!.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
        options: { captchaToken },
      });
      if (error) throw captchaError(error);
      await refresh();
    },
    [mode, refresh],
  );

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!profile) throw new Error('Sem perfil ativo.');
      const next = { ...profile, ...patch, updated_at: new Date().toISOString() };
      if (mode === 'local') {
        await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        setProfile(next);
        return;
      }
      const { error } = await supabase!.from('profiles').update(patch).eq('id', profile.id);
      if (error) throw error;
      setProfile(next);
    },
    [mode, profile],
  );

  const signOut = useCallback(async () => {
    if (mode === 'local') {
      await AsyncStorage.removeItem(LOCAL_KEY);
      setProfile(null);
      return;
    }
    await supabase!.auth.signOut();
    setProfile(null);
    setVisitorView(false);
  }, [mode]);

  const value = useMemo<Ctx>(() => {
    const canPreviewVisitor = profile?.role === 'admin';
    // na visão de visitante tudo que vem do perfil some, como se não tivesse sessão
    const seen = canPreviewVisitor && visitorView ? null : profile;
    const role = seen?.role ?? null;
    const militantish = role === 'militant' || role === 'moderator' || role === 'admin';
    return {
      ready,
      mode,
      profile: seen,
      role,
      membership: seen?.membership_status ?? null,
      // conta suspensa (is_active false) perde a base e a moderação; o banco já corta tudo
      isBaseMember: Boolean(militantish && seen?.membership_status === 'active' && seen?.is_active !== false),
      isModerator: (role === 'moderator' || role === 'admin') && seen?.is_active !== false,
      isAdmin: role === 'admin',
      flags,
      visitorView: canPreviewVisitor && visitorView,
      canPreviewVisitor,
      setVisitorView,
      signUpWithInvite,
      signIn,
      requestPasswordReset,
      resetPassword,
      updateProfile,
      signOut,
      refresh,
    };
  }, [ready, mode, profile, flags, visitorView, signUpWithInvite, signIn, requestPasswordReset, resetPassword, updateProfile, signOut, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return ctx;
}
