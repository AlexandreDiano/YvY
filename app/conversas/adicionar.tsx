import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { addByCode, myFingerprint, newAddCode } from '@/api/chat';
import { useAuth } from '@/features/auth/AuthProvider';
import { ChatGate } from '@/features/chat/ChatGate';
import { env } from '@/lib/env';
import { Banner, Button, Card, Field, Options, Screen, Section, Txt, radius, space } from '@/ui';

/**
 * Adicionar pessoa: um mostra o QRCode (ou o código), o outro lê. Ler manda
 * um pedido; quem mostrou aceita na lista de Conversas. O QRCode leva também
 * a impressão digital da chave de quem mostrou, para o app conferir depois
 * que a chave recebida pelo servidor é a mesma.
 */
export default function Adicionar() {
  return (
    <ChatGate>
      <Tela />
    </ChatGate>
  );
}

function Tela() {
  const { profile } = useAuth();
  const me = profile!.id;
  const params = useLocalSearchParams<{ c?: string; f?: string }>();
  const [mode, setMode] = useState<'show' | 'read'>(params.c ? 'read' : 'show');
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [fp, setFp] = useState('');
  const [left, setLeft] = useState(0);
  const [manual, setManual] = useState(params.c ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  const generate = useCallback(async () => {
    setError(null);
    try {
      const [c, f] = await Promise.all([newAddCode(), myFingerprint(me)]);
      setCode(c);
      setFp(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar o código.');
    }
  }, [me]);

  useEffect(() => {
    if (mode === 'show' && !code) void generate();
  }, [mode, code, generate]);

  useEffect(() => {
    if (!code) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(code.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [code]);

  async function submit(typed: string) {
    if (!typed.trim()) return;
    // abriu pelo link do QRCode: manda o link inteiro, com a impressão digital
    const raw =
      params.c && params.f && typed.trim().toUpperCase() === params.c.toUpperCase()
        ? `https://x/?c=${params.c}&f=${params.f}`
        : typed;
    setBusy(true);
    setError(null);
    try {
      await addByCode(me, raw);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível adicionar.');
      handled.current = false;
    } finally {
      setBusy(false);
    }
  }

  const base = env.siteUrl || 'https://www.useyvy.app';
  const link = code ? `${base}/conversas/adicionar?c=${code.code}&f=${fp.replace(/\s/g, '')}` : '';

  return (
    <Screen>
      <Options
        value={mode}
        onChange={(v) => {
          setMode(v);
          setError(null);
          handled.current = false;
        }}
        options={[
          { key: 'show', label: 'Mostrar meu código' },
          { key: 'read', label: 'Ler código de alguém' },
        ]}
      />

      {mode === 'show' ? (
        <>
          <Banner
            title="Mostre para quem está com você"
            detail="A pessoa lê com o YvY dela e te manda um pedido. Você aceita em Conversas. Vale 10 minutos."
          />
          {code ? (
            <Card>
              <View style={s.qr}>
                <QRCode value={link} size={220} color="#000000" backgroundColor="#FFFFFF" />
              </View>
              <Txt variant="title" center>
                {code.code.replace(/(.{5})/, '$1 ')}
              </Txt>
              <Txt variant="small" muted center>
                {left > 0 ? `Vale por mais ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Venceu. Gere outro.'}
              </Txt>
              <Txt variant="small" muted center>
                Sua impressão digital: {fp}
              </Txt>
              <Button title="Gerar outro código" kind="outline" onPress={() => void generate()} />
            </Card>
          ) : null}
        </>
      ) : done ? (
        <Card>
          <Txt variant="heading">Pedido enviado</Txt>
          <Txt variant="small" muted>
            Quando a pessoa aceitar, a conversa aparece na sua lista.
          </Txt>
          <Button title="Voltar para Conversas" onPress={() => router.back()} />
        </Card>
      ) : (
        <>
          {permission?.granted ? (
            <View style={s.cameraBox}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => {
                  if (handled.current) return;
                  handled.current = true;
                  void submit(data);
                }}
              />
            </View>
          ) : (
            <Card>
              <Txt variant="small" muted>
                A câmera serve só para ler o QRCode da outra pessoa.
              </Txt>
              <Button title="Permitir câmera" onPress={() => void requestPermission()} />
            </Card>
          )}
          <Section title="Ou digite o código" />
          <Field
            label="Código de 10 letras e números"
            value={manual}
            onChangeText={setManual}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => void submit(manual)}
          />
          <Button title="Pedir para conversar" loading={busy} onPress={() => void submit(manual)} />
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

const s = StyleSheet.create({
  qr: { alignSelf: 'center', padding: space.md, backgroundColor: '#FFFFFF', borderRadius: radius.md },
  cameraBox: { height: 300, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000' },
});
