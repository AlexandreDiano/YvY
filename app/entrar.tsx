import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { Banner, Button, Field, Screen, Section, Txt } from '@/ui';

/** Login de quem já tem conta (e-mail + senha). */
export default function Entrar() {
  const router = useRouter();
  const { signIn, mode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'E-mail ou senha não conferem.');
    } finally {
      setBusy(false);
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
      />
      <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : null}
      <Button title="Entrar" loading={busy} onPress={submit} />

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
