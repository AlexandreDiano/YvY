import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { SignupForm } from '@/features/signup/SignupForm';
import { Banner, Button, Screen } from '@/ui';

/** Fluxo 4.2, passo 7: cadastro depois do QRCode validado. */
export default function CadastroMilitante() {
  const { token, inviter } = useLocalSearchParams<{ token?: string; inviter?: string }>();
  const { signUpWithInvite } = useAuth();
  const router = useRouter();

  if (!token) {
    return (
      <Screen>
        <Banner
          tone="warning"
          title="Sem convite não há cadastro"
          detail="A conta do YvY só é criada depois de ler o QRCode de um camarada, presencialmente."
        />
        <Button title="Ler QRCode de convite" onPress={() => router.replace('/cadastro/convite')} />
      </Screen>
    );
  }

  return (
    <SignupForm
      inviterName={inviter}
      onSubmit={async (input) => {
        const status = await signUpWithInvite(token, input);
        if (status === 'email_pending') {
          router.replace('/entrar');
          Alert.alert(
            'Confirme seu e-mail',
            `Enviamos um link para ${input.email.trim()}. Confirme e depois entre com seu e-mail e senha neste celular — o convite é usado nessa hora. O convite vale 24h.`,
          );
          return;
        }
        router.replace('/(tabs)');
        if (status === 'pending') {
          Alert.alert(
            'Conta criada',
            'O camarada que te convidou tem 24h para confirmar. Até lá você vê o conteúdo público.',
          );
        }
      }}
    />
  );
}
