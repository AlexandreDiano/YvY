import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { Button, Field, Screen, Section, Txt } from '@/ui';

/**
 * Esqueci a senha: código por e-mail, sem link.
 *
 * Link de recuperação dependeria de deep link (yvy:// no APK, exp:// no Expo
 * Go) e de Redirect URL no Supabase. Código digitado funciona igual em todo
 * lugar — exige o template "Reset Password" com {{ .Token }}.
 */
export default function Senha() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { requestPasswordReset, resetPassword } = useAuth();
  const [email, setEmail] = useState(params.email ?? '');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setError(null);
    if (password.length < 8) return setError('A senha nova precisa de pelo menos 8 caracteres.');
    if (password !== confirm) return setError('As duas senhas não são iguais.');
    setBusy(true);
    try {
      await resetPassword(email, code, password);
      Alert.alert('Senha trocada', 'Você já está dentro.');
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
      />
      {!sent ? (
        <Button title="Enviar código" loading={busy} disabled={!email.includes('@')} onPress={() => void send()} />
      ) : (
        <>
          {/* Mesma resposta exista ou não a conta: a tela não revela quem tem cadastro. */}
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
          />
          <Field label="Senha nova" value={password} onChangeText={setPassword} secureTextEntry />
          <Field label="Repita a senha nova" value={confirm} onChangeText={setConfirm} secureTextEntry />
          <Button
            title="Trocar senha"
            loading={busy}
            disabled={digits.length < 6 || !password}
            onPress={() => void save()}
          />
          <Button title="Mandar outro código" kind="ghost" disabled={busy} onPress={() => void send()} />
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
