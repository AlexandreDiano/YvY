/**
 * Ponte entre a página do mapa (Leaflet) e o app, igual no celular (WebView) e
 * no site (iframe). Ver MapFrame.tsx e MapFrame.web.tsx. `send(texto)` no HTML
 * chega em `onMessage`; `ref.post(dado)` chama `window.onHost(dado)` no HTML.
 */
export type MapFrameHandle = { post: (data: unknown) => void };

/** Script que toda página de mapa inclui antes do próprio código. */
export const MAP_BRIDGE = `
function send(m){
  if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(String(m))}
  else if(window.parent!==window){window.parent.postMessage({yvyMap:String(m)},'*')}
}
window.addEventListener('message',function(e){
  if(e.source===window.parent&&e.data&&e.data.yvyHost!==undefined&&window.onHost){window.onHost(e.data.yvyHost)}
});`;
