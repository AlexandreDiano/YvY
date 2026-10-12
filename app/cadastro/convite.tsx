import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { parseInviteLink, peekInvite } from '../../src/api/invites';
import {
  Banner,
  Button,
  Field,
  Screen,
  Section,
  Txt,
  color,
  radius,
  space,
} from '../../src/ui';

/**
 * Fluxo 4.2, passos 4–6: ler o QRCode do convite.
 *
 * O código digitado é o convite à distância (só moderador/admin gera, 0015).
 * Também serve a quem está na web, onde não há leitura de QRCode.
 */
export default function EntrarComConvite() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  async function accept(scanned: string) {
    const token = parseInviteLink(scanned);
    if (!token) {
      setError('Esse QRCode não é um convite do YvY.');
      handled.current = false;
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const check = await peekInvite(token);
      if (!check.ok) {
        setError(check.reason);
        handled.current = false;
        return;
      }
      router.push({ pathname: '/cadastro/militante', params: { token } });
    } finally {
      setBusy(false);
    }
  }

  const canScan = Platform.OS !== 'web' && permission?.granted;

  return (
    <Screen>
      <Banner
        title="O convite é presencial"
        detail="Peça para o camarada abrir o YvY dele em Perfil › Convidar camarada e aponte a câmera para o QRCode na tela dele."
      />

      {canScan ? (
        <View style={s.cameraBox}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (handled.current) return;
              handled.current = true;
              void accept(data);
            }}
          />
          <View style={s.frame} pointerEvents="none" />
        </View>
      ) : (
        <View style={s.placeholder}>
          <Txt variant="body" center muted>
            {Platform.OS === 'web'
              ? 'A leitura de QRCode roda no app instalado. No navegador, use o código abaixo.'
              : 'Precisamos da câmera só para ler o QRCode do convite.'}
          </Txt>
          {Platform.OS !== 'web' ? (
            <Button title="Permitir câmera" onPress={() => void requestPermission()} />
          ) : null}
        </View>
      )}

      <Section title="Recebeu um código?" />
      <Field
        label="Código do convite"
        value={manual}
        onChangeText={setManual}
        autoCapitalize="none"
        placeholder="00000000-0000-0000-0000-000000000000"
        hint="Para quem foi convidado à distância por um moderador. Vale 1 uso e expira em 24h."
      />
      <Button title="Validar código" kind="outline" loading={busy} onPress={() => void accept(manual.trim())} />

      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  // Sem overflow/borda arredondada no Android: recortar a pré-visualização da
  // câmera ali deixa a tela preta.
  cameraBox: {
    height: 320,
    backgroundColor: '#000',
    ...(Platform.OS === 'ios' ? { borderRadius: radius.md, overflow: 'hidden' as const } : null),
  },
  frame: {
    position: 'absolute',
    top: 60,
    left: 60,
    right: 60,
    bottom: 60,
    borderWidth: 2,
    borderColor: color.surface,
    borderRadius: radius.md,
  },
  placeholder: {
    minHeight: 160,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.lg,
  },
});
