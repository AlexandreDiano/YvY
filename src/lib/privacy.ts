import { useFocusEffect } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { useCallback } from 'react';
import { Platform } from 'react-native';

/**
 * Bloqueia print e gravação de tela enquanto ESTA tela está em foco. Usar nas
 * telas com dado de outras pessoas: Base (feed), Moderar e Convidar.
 *
 * Por foco e com chave própria: as abas ficam montadas em segundo plano, e
 * com a chave padrão compartilhada uma tela que fechava liberava o print das
 * outras. No navegador não existe esse bloqueio.
 */
export function useNoScreenshots(key: string): void {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return;
      void ScreenCapture.preventScreenCaptureAsync(key).catch(() => undefined);
      return () => {
        void ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined);
      };
    }, [key]),
  );
}
