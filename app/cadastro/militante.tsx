import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { CLAIM_TTL_H, clearClaim, storedClaim, type InviteClaim } from '@/api/invites';
import { useAuth } from '@/features/auth/AuthProvider';
import { SignupForm } from '@/features/signup/SignupForm';
import { notify } from '@/lib/notify';
import { Banner, Button, Loading, Screen } from '@/ui';

/**
 * Fluxo 4.2, passo 7: cadastro depois do QRCode lido.
 *
 * A reserva do convite (claimInvite) fica no aparelho, não na rota: no site,
 * parâmetro de rota vira URL — histórico, print, log do servidor.
 */
export default function CadastroMilitante() {
  const { signUpWithInvite } = useAuth();
  const router = useRouter();
  const [claim, setClaim] = useState<InviteClaim | null | undefined>(undefined);

  useEffect(() => {
    void storedClaim().then(setClaim);
  }, []);

  if (claim === undefined) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (!claim) {
    return (
      <Screen>
        <Banner
          tone="warning"
          title="Sem convite não há cadastro"
          detail={`A conta do YvY só é criada depois de ler o QRCode de um camarada, presencialmente. Depois de ler, você tem ${CLAIM_TTL_H}h para terminar o cadastro.`}
        />
        <Button title="Ler QRCode de convite" onPress={() => router.replace('/cadastro/convite')} />
      </Screen>
    );
  }

  const until = new Date(claim.expiresAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <SignupForm
      onSubmit={async (input) => {
        const status = await signUpWithInvite(claim.claim, input);
        // Reserva usada (ou guardada no cadastro pendente de e-mail): sai daqui.
        await clearClaim();
        if (status === 'email_pending') {
          router.replace('/entrar');
          notify(
            'Confirme seu e-mail',
            `Enviamos um link para ${input.email.trim()}. Confirme e depois entre com seu e-mail e senha neste celular — o convite é usado nessa hora. Seu convite fica guardado até ${until}.`,
          );
          return;
        }
        router.replace('/(tabs)');
        if (status === 'pending') {
          notify(
            'Conta criada',
            'Agora o camarada que te convidou precisa confirmar você. Até lá você vê o conteúdo público.',
          );
        }
      }}
    />
  );
}
