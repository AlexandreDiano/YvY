import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { env } from '@/lib/env';
import { Txt } from '@/ui/Text';
import { space } from '@/ui/tokens';
import { isDark } from '@/ui/theme';

/**
 * Captcha (Cloudflare Turnstile) no APK, numa WebView que abre /captcha do
 * site. Precisa de EXPO_PUBLIC_SITE_URL no build porque a chave só vale nos
 * domínios cadastrados no Cloudflare. A versão web é Captcha.web.tsx.
 */
export function Captcha({ onToken }: { onToken: (token: string | null) => void }) {
  const [failed, setFailed] = useState(false);

  if (!env.siteUrl) {
    return (
      <Txt variant="small" tone="danger">
        Verificação indisponível neste app: atualize para a versão mais nova.
      </Txt>
    );
  }
  const uri = `${env.siteUrl}/captcha?k=${encodeURIComponent(env.turnstileSiteKey)}&t=${isDark ? 'dark' : 'light'}`;

  return (
    <View style={s.box}>
      <WebView
        source={{ uri }}
        style={s.web}
        scrollEnabled={false}
        onMessage={(e) => {
          const m = e.nativeEvent.data;
          if (m.startsWith('token:')) onToken(m.slice(6));
          else {
            onToken(null);
            if (m === 'error') setFailed(true);
          }
        }}
        onError={() => setFailed(true)}
      />
      {failed ? (
        <Txt variant="small" tone="danger">
          Não deu para carregar a verificação. Confira a internet e tente de novo.
        </Txt>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: { gap: space.xs },
  web: { height: 72, backgroundColor: 'transparent' },
});
