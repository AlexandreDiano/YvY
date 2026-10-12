import { forwardRef, useImperativeHandle, useRef } from 'react';
import { WebView } from 'react-native-webview';
import type { MapFrameHandle } from '@/ui/mapBridge';

export { MAP_BRIDGE, type MapFrameHandle } from '@/ui/mapBridge';

/**
 * Moldura do mapa Leaflet (HTML próprio). No celular é uma WebView; no site,
 * um iframe isolado (MapFrame.web.tsx). Mesma ponte nos dois:
 *  - página → app: `send(texto)` no HTML (MAP_BRIDGE) chega em `onMessage`;
 *  - app → página: `ref.post(dado)` chama `window.onHost(dado)` no HTML.
 */

type Props = { html: string; onMessage?: (data: string) => void; onReady?: () => void };

export const MapFrame = forwardRef<MapFrameHandle, Props>(function MapFrame({ html, onMessage, onReady }, ref) {
  const web = useRef<WebView>(null);
  useImperativeHandle(ref, () => ({
    post(data) {
      const json = JSON.stringify(data).replace(/</g, '\\u003c');
      web.current?.injectJavaScript(`window.onHost && window.onHost(${json}); true;`);
    },
  }));
  return (
    <WebView
      ref={web}
      originWhitelist={['*']}
      source={{ html }}
      onLoadEnd={onReady}
      onMessage={(e) => onMessage?.(e.nativeEvent.data)}
      nestedScrollEnabled
    />
  );
});
