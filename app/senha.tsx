import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCaptcha } from '@/features/auth/useCaptcha';
import { notify } from '@/lib/notify';
import { Button, Field, Screen, Section, Txt } from '@/ui';

/**
 * Esqueci a senha, com código por e-mail em vez de link.
 *
 * Link de recuperação precisaria de deep link (yvy:// no APK, exp:// no Expo
 * Go) e de Redirect URL no Supabase. Código digitado funciona igual em todo
 * lugar. Precisa do template "Reset Password" com {{ .Token }}.
 */
export default function Senha() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { requestPasswordReset, resetPassword } = useAuth();
  const captcha = useCaptcha();
  const [email, setEmail] = useState(params.email ?? '');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  async function send() {
    if (busy || !email.includes('@') || !captcha.ready) return;
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email, captcha.token);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar.');
    } finally {
      setBusy(false);
      captcha.reset();
    }
  }

  async function save() {
    if (busy || code.replace(/\D+/g, '').length < 6 || !password) return;
    setError(null);
    if (password.length < 8) return setError('A senha nova precisa de pelo menos 8 caracteres.');
    if (password !== confirm) return setError('As duas senhas não são iguais.');
    setBusy(true);
    try {
      await resetPassword(email, code, password);
      notify('Senha trocada', 'Você já está dentro.');
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível trocar a senha.');
    } finally {
      setBusy(false);
    }
  }

  const digits = code.replace(/\D+/g, '');

  return (
    <Screen>
      <Section title="Recuperar senha" />
      <Field
        label="E-mail da sua conta"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setSent(false);
        }}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="voce@exemplo.com"
        returnKeyType="send"
        onSubmitEditing={() => {
          if (!sent) void send();
        }}
      />
      {!sent ? (
        <>
          {captcha.widget}
          <Button
            title="Enviar código"
            loading={busy}
            disabled={!email.includes('@') || !captcha.ready}
            onPress={() => void send()}
          />
        </>
      ) : (
        <>
          {/* Mesma resposta com ou sem conta, para a tela não revelar quem tem cadastro. */}
          <Txt variant="small" muted>
            Se existir uma conta com esse e-mail, chegou um código. Olhe também o spam. O código vale por pouco
            tempo.
          </Txt>
          <Field
            label="Código do e-mail"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="123456"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Field
            ref={passwordRef}
            label="Senha nova"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          <Field
            ref={confirmRef}
            label="Repita a senha nova"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={() => void save()}
          />
          <Button
            title="Trocar senha"
            loading={busy}
            disabled={digits.length < 6 || !password}
            onPress={() => void save()}
          />
          {captcha.widget}
          <Button
            title="Mandar outro código"
            kind="ghost"
            disabled={busy || !captcha.ready}
            onPress={() => void send()}
          />
        </>
      )}
      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : null}
    </Screen>
  );
}
