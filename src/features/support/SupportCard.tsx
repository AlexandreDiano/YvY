import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { env } from '@/lib/env';
import { notify } from '@/lib/notify';
import { pixPayload } from '@/lib/pix';
import { Button, Card, Txt, radius, space } from '@/ui';

/**
 * Apoio por Pix, sem valor sugerido: quem quiser manda quanto quiser.
 * Só para membro confirmado (quem chama decide) e só com EXPO_PUBLIC_PIX_KEY.
 */
export function SupportCard() {
  const [more, setMore] = useState(false);
  if (!env.pixKey) return null;

  const code = pixPayload(env.pixKey, env.pixName, env.pixCity);

  return (
    <Card style={s.gap}>
      <Txt variant="body">
        O YvY é independente: domínio, servidor e checagem automática têm custo todo mês. Quer ajudar a
        manter isso no ar? Mande um Pix de qualquer valor.
      </Txt>

      <Button
        title="Copiar código Pix"
        onPress={async () => {
          await Clipboard.setStringAsync(code);
          notify('Código Pix copiado', 'No app do seu banco, escolha Pix › Copia e Cola e defina o valor.');
        }}
      />

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
  qr: {
    alignSelf: 'center',
    padding: space.md,
    backgroundColor: '#FFFFFF', // QR sempre em fundo claro: leitor falha com QR invertido
    borderRadius: radius.md,
  },
});
