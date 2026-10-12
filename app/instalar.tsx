import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { InstallCard } from '@/features/pwa/InstallCard';
import { useInstall } from '@/features/pwa/install';
import { Button, Screen, Txt, YvyLogo, space } from '@/ui';

/** Onde o QRCode do site leva: instalar o app no celular, e só isso. */
export default function Instalar() {
  const router = useRouter();
  const { kind } = useInstall();

  return (
    <Screen safeTop contentStyle={s.wrap}>
      <View style={s.brand}>
        <YvyLogo size={120} />
        <Txt variant="title" center>
          {kind === 'none' ? 'YvY' : 'Instale o YvY'}
        </Txt>
      </View>
      <InstallCard />
      <Button title="Abrir o YvY" kind="ghost" onPress={() => router.replace('/')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', gap: space.lg, padding: space.xl },
  brand: { alignItems: 'center', gap: space.sm },
});
