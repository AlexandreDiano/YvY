import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { InstallCard } from '@/features/pwa/InstallCard';
import { daysToElection, electionLabel } from '@/lib/format';
import { Button, Screen, Spacer, Txt, YvyLogo, space } from '@/ui';

export default function Welcome() {
  const router = useRouter();
  const { mode } = useAuth();
  const dias = daysToElection();

  return (
    <Screen safeTop contentStyle={s.wrap}>
      <View style={s.brand}>
        <YvyLogo size={168} />
        <Txt variant="small" muted>
          Do guarani: terra
        </Txt>
      </View>

      <View style={s.pitch}>
        <Txt variant="title" center>
          A terra é de quem a organiza.
        </Txt>
        <Txt variant="body" muted center>
          {dias > 0
            ? `${dias} ${dias === 1 ? 'dia' : 'dias'} para o 2º turno · ${electionLabel()}`
            : `Dia de votação · ${electionLabel()}`}
        </Txt>
      </View>

      <View style={s.actions}>
        <Button title="Ver propostas, checagem e Congresso" onPress={() => router.push('/publico')} />
        <Txt variant="small" muted center>
          Não precisa de cadastro.
        </Txt>
        <Button title="Entrar" kind="outline" onPress={() => router.push('/entrar')} />
        <Button title="Tenho um convite" kind="ghost" onPress={() => router.push('/cadastro/convite')} />
      </View>

      <InstallCard compact />

      {mode === 'local' ? (
        <>
          <Spacer size={space.sm} />
          <Txt variant="small" muted center>
            Modo local: sem backend configurado. Conteúdo público funciona; o
            resto fica salvo só neste aparelho.
          </Txt>
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', gap: space.xl, padding: space.xl },
  brand: { alignItems: 'center', gap: space.xs },
  pitch: { gap: space.sm },
  actions: { gap: space.md },
});
