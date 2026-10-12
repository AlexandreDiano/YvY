import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { env } from '@/lib/env';
import { notify } from '@/lib/notify';
import { BANKS, canOpenBank, openBank, pixPayload } from '@/lib/pix';
import { Button, Card, Chip, Txt, radius, space } from '@/ui';

/**
 * Apoio por Pix, sem valor sugerido: quem quiser manda quanto quiser.
 * Só para membro confirmado (quem chama decide) e só com EXPO_PUBLIC_PIX_KEY.
 */
export function SupportCard() {
  const [banks, setBanks] = useState(false);
  const [more, setMore] = useState(false);
  if (!env.pixKey) return null;

  const code = pixPayload(env.pixKey, env.pixName, env.pixCity);

  /**
   * Um botão só: copia o copia e cola e, no Android, mostra os bancos para
   * abrir. Nenhum banco aceita abrir já na tela de Pix com chave preenchida
   * vindo de fora, então o último passo (colar) é da pessoa.
   */
  async function sendPix() {
    await Clipboard.setStringAsync(code);
    if (canOpenBank()) {
      setBanks(true);
      return;
    }
    notify('Código Pix copiado', 'Abra o app do seu banco, escolha Pix › Copia e Cola e defina o valor.');
  }

  return (
    <Card style={s.gap}>
      <Txt variant="body">
        O YvY é independente: domínio, servidor e checagem automática têm custo todo mês. Quer ajudar a
        manter isso no ar? Mande um Pix de qualquer valor.
      </Txt>

      <Button title="Mandar Pix" onPress={() => void sendPix()} />

      {banks ? (
        <>
          <Txt variant="small" muted>
            Código copiado. Toque no seu banco e, lá dentro, escolha Pix › Copia e Cola.
          </Txt>
          <View style={s.banks}>
            {BANKS.map((b) => (
              <Chip key={b.pkg} label={b.name} onPress={() => void openBank(b.pkg)} />
            ))}
          </View>
          <Txt variant="small" muted>
            Seu banco não está aqui? Abra ele normalmente: o código já está copiado.
          </Txt>
        </>
      ) : null}

      <Button
        title={more ? 'Esconder outras formas' : 'Outras formas (QRCode e chave)'}
        kind="ghost"
        small
        onPress={() => setMore((v) => !v)}
      />
      {more ? (
        <>
          <View style={s.qr}>
            <QRCode value={code} size={180} color="#000000" backgroundColor="#FFFFFF" />
          </View>
          <Txt variant="small" muted center>
            Escaneie com o app do banco em outro celular.
          </Txt>
          <Txt variant="small" muted selectable center>
            Chave Pix: {env.pixKey}
          </Txt>
        </>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  gap: { gap: space.sm },
  banks: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  qr: {
    alignSelf: 'center',
    padding: space.md,
    backgroundColor: '#FFFFFF', // QR sempre em fundo claro: leitor falha com QR invertido
    borderRadius: radius.md,
  },
});
