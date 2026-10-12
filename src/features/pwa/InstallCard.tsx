import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button, Card, Txt, space } from '@/ui';
import { useInstall } from '@/features/pwa/install';

/**
 * Convite para instalar o app, só na web e só quando ainda não está
 * instalado. No celular nativo e no app já instalado não desenha nada.
 *
 * - Computador: QRCode para /instalar, que abre no celular.
 * - Android: botão que chama a instalação do Chrome.
 * - iPhone: os dois toques no Safari (a Apple não deixa site instalar).
 *
 * `compact` é para dentro de outras telas (boas-vindas, perfil); sem ele,
 * é o conteúdo da página /instalar.
 */
export function InstallCard({ compact }: { compact?: boolean }) {
  const { kind, install, url } = useInstall();
  if (kind === 'none') return null;

  if (kind === 'desktop') {
    return (
      <Card style={s.center}>
        <Txt variant="label" center>
          Use no celular
        </Txt>
        <View style={s.qr}>
          <QRCode value={url} size={compact ? 140 : 220} color="#1E7440" backgroundColor="#FFFFFF" />
        </View>
        <Txt variant="small" muted center>
          Aponte a câmera do celular e instale o YvY como app. Sem loja, sem download pesado.
        </Txt>
      </Card>
    );
  }

  if (kind === 'prompt') {
    return (
      <Card style={s.gap}>
        {compact ? null : (
          <Txt variant="small" muted>
            Fica na tela inicial como qualquer app e abre em tela cheia.
          </Txt>
        )}
        <Button title="Instalar o YvY" onPress={() => void install()} />
      </Card>
    );
  }

  return (
    <Card style={s.gap}>
      <Txt variant="label">Instalar o YvY</Txt>
      {kind === 'ios' ? (
        <>
          <Txt variant="small">
            1. No Safari, toque em ••• (canto de baixo) e depois em Compartilhar. Em iPhone mais antigo, o
            Compartilhar (quadrado com seta para cima) já fica na barra.
          </Txt>
          <Txt variant="small">2. Role a lista e toque em "Adicionar à Tela de Início".</Txt>
          <Txt variant="small">3. Deixe "Abrir como App Web" ligado e toque em Adicionar.</Txt>
        </>
      ) : (
        <>
          <Txt variant="small">1. Toque no menu ⋮ do navegador.</Txt>
          <Txt variant="small">2. Toque em "Instalar app" ou "Adicionar à tela inicial".</Txt>
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', gap: space.sm },
  gap: { gap: space.sm },
  qr: { padding: space.sm, backgroundColor: '#FFFFFF' },
});
