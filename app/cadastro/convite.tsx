import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { claimInvite, parseInviteLink } from '@/api/invites';
import {
  Banner,
  Button,
  Card,
  Field,
  Screen,
  Section,
  Txt,
  color,
  radius,
  space,
} from '@/ui';

/**
 * Leitura do convite.
 *
 * O código digitado é o convite à distância (só moderador/admin gera). O link
 * do QRCode abre esta tela no site com `#t=<token>`; o APK aceita também
 * `?t=` (yvy://cadastro/convite?t=).
 *
 * Ler o convite já reserva a vaga (claimInvite, migration 0035). Pela câmera
 * do app ou pelo código, reserva na hora. Pelo link, só depois do toque em
 * "Aceitar convite", porque pré-visualização do WhatsApp ou página carregada
 * duas vezes não pode gastar o convite.
 */
export default function EntrarComConvite() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);
  const params = useLocalSearchParams<{ t?: string }>();
  const [linked, setLinked] = useState<string | null>(null);

  useEffect(() => {
    let token = typeof params.t === 'string' ? params.t : null;
    if (!token && Platform.OS === 'web' && typeof window !== 'undefined') {
      token = new URLSearchParams(window.location.hash.slice(1)).get('t');
      // Tira o token da barra de endereço (histórico, print, compartilhar).
      // O state do roteador vai junto, senão o botão voltar se perde.
      if (token) window.history.replaceState(window.history.state, '', window.location.pathname);
    }
    if (token) setLinked(token);
  }, [params.t]);

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
      // o segredo da reserva fica no aparelho, a tela de cadastro lê de lá
      await claimInvite(token);
      setLinked(null);
      router.push('/cadastro/militante');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível usar o convite.');
      handled.current = false;
    } finally {
      setBusy(false);
    }
  }

  // No site também funciona: o expo-camera usa o BarcodeDetector do Chrome ou,
  // no Safari, a lib barcode-detector. Precisa de HTTPS.
  const canScan = Boolean(permission?.granted);

  return (
    <Screen>
      <Banner
        title="O convite é presencial"
        detail="Peça para o camarada abrir o YvY dele em Perfil › Convidar camarada e aponte a câmera para o QRCode na tela dele."
      />

      {linked ? (
        <Card>
          <Txt variant="label">Você recebeu um convite</Txt>
          <Txt variant="small" muted>
            Ao aceitar, a vaga fica guardada neste celular por 24h para você terminar o cadastro.
          </Txt>
          <Button title="Aceitar convite" loading={busy} onPress={() => void accept(linked)} />
        </Card>
      ) : null}

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
            {permission && !permission.granted && !permission.canAskAgain
              ? 'A câmera está bloqueada para o YvY. Libere nas configurações do navegador/celular, ou use o código abaixo.'
              : 'Precisamos da câmera só para ler o QRCode do convite.'}
          </Txt>
          <Button title="Permitir câmera" onPress={() => void requestPermission()} />
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
  // Nada de overflow/borda arredondada aqui: no Android, recortar a prévia da
  // câmera deixa a tela preta.
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
