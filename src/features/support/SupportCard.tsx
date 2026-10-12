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
  const [showQr, setShowQr] = useState(false);
  if (!env.pixKey) return null;

  const code = pixPayload(env.pixKey, env.pixName, env.pixCity);

  async function copyCode() {
    await Clipboard.setStringAsync(code);
  }

  return (
    <Card style={s.gap}>
      <Txt variant="body">
        O YvY é independente: domínio, servidor e checagem automática têm custo todo mês. Quer ajudar a
        manter isso no ar? Mande um Pix de qualquer valor.
      </Txt>

      <Button
        title="Copiar Pix copia e cola"
        onPress={async () => {
          await copyCode();
          notify('Código Pix copiado', 'No app do seu banco, escolha Pix › Copia e Cola e defina o valor.');
        }}
      />

      {canOpenBank() ? (
        <>
          <Txt variant="small" muted>
            Ou toque no seu banco: o código é copiado e o app abre.
          </Txt>
          <View style={s.banks}>
            {BANKS.map((b) => (
              <Chip
                key={b.pkg}
                label={b.name}
                onPress={async () => {
                  await copyCode();
                  await openBank(b.pkg);
                }}
              />
            ))}
          </View>
        </>
      ) : null}

      <Button
        title={showQr ? 'Esconder QRCode Pix' : 'Mostrar QRCode Pix'}
        kind="ghost"
        small
        onPress={() => setShowQr((v) => !v)}
      />
      {showQr ? (
        <View style={s.qr}>
          <QRCode value={code} size={180} color="#000000" backgroundColor="#FFFFFF" />
        </View>
      ) : null}

      <Txt variant="small" muted selectable>
        Chave Pix: {env.pixKey}
      </Txt>
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
