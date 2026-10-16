import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCaptcha } from '@/features/auth/useCaptcha';
import { Banner, Button, Field, Screen, Section, Txt } from '@/ui';

export default function Entrar() {
  const router = useRouter();
  const { signIn, mode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captcha = useCaptcha();
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    if (busy || !captcha.ready) return;
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password, captcha.token);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'E-mail ou senha não conferem.');
    } finally {
      setBusy(false);
      // token do captcha só vale uma vez, gera outro para a próxima tentativa
      captcha.reset();
    }
  }

  return (
    <Screen>
      {mode === 'local' ? (
        <Banner
          tone="warning"
          title="Modo local"
          detail="Sem backend configurado não há login. Entre com um convite para criar o perfil local."
        />
      ) : null}

      <Section title="Entrar" />
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="voce@exemplo.com"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Field
        ref={passwordRef}
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : null}
      {captcha.widget}
      <Button title="Entrar" loading={busy} disabled={!captcha.ready} onPress={submit} />

      <Button
        title="Esqueci a senha"
        kind="ghost"
        onPress={() => router.push({ pathname: '/senha', params: email ? { email } : {} })}
      />
      <Button
        title="Não tenho conta — tenho um convite"
        kind="ghost"
        onPress={() => router.replace('/cadastro/convite')}
      />
    </Screen>
  );
}
