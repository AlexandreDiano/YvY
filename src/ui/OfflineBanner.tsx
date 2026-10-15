import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '@/ui/Text';
import { color, space } from '@/ui/tokens';

/**
 * Faixa de "sem internet" no site/PWA. O app continua abrindo (service worker)
 * e o conteúdo público sai do cache ou do seed; a faixa explica por que o resto
 * não carrega. No APK não aparece, lá não tem evento de rede sem lib nativa.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;
  return (
    <View style={[s.bar, { paddingTop: insets.top + space.xs }]} accessibilityRole="alert">
      <Txt variant="small" center>
        Sem internet. Mostrando o que ficou salvo neste aparelho.
      </Txt>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: color.warningSoft,
    borderBottomWidth: 1,
    borderBottomColor: color.warning,
    paddingHorizontal: space.md,
    paddingBottom: space.xs,
  },
});
