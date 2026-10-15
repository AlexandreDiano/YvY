import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { MapFrameHandle } from '@/ui/mapBridge';

export { MAP_BRIDGE, type MapFrameHandle } from '@/ui/mapBridge';

type Props = { html: string; onMessage?: (data: string) => void; onReady?: () => void };

/**
 * Versão site/PWA: iframe com `srcdoc` e `sandbox="allow-scripts"`, sem
 * allow-same-origin. Sem isso o HTML do mapa rodaria com a origem do YvY e
 * enxergaria o localStorage (onde está a sessão do Supabase), e título de ação
 * vem de membro. A conversa é só por postMessage, conferindo de qual iframe veio.
 */
export const MapFrame = forwardRef<MapFrameHandle, Props>(function MapFrame({ html, onMessage, onReady }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);

  useImperativeHandle(ref, () => ({
    post(data) {
      frame.current?.contentWindow?.postMessage({ yvyHost: data }, '*');
    },
  }));

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.source !== frame.current?.contentWindow) return;
      const m = (e.data as { yvyMap?: unknown } | null)?.yvyMap;
      if (typeof m === 'string') onMessage?.(m);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onMessage]);

  return (
    <iframe
      ref={frame}
      title="Mapa"
      srcDoc={html}
      sandbox="allow-scripts"
      onLoad={onReady}
      style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
    />
  );
});
