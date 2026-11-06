import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * HTML da versão web. Só roda no export estático, nunca no celular.
 *
 * O que transforma o site em PWA instalável: manifest e ícones de public/icons
 * (saem do scripts/gen-icons.py), as meta tags do iOS (o Safari ignora boa
 * parte do manifest no "Adicionar à Tela de Início") e o service worker em
 * public/sw.js. O SW não é registrado em localhost, senão fica servindo
 * bundle velho enquanto a gente desenvolve.
 *
 * Tema escuro (YVY-139): o HTML sai do build no tema claro, com as classes de
 * CSS do react-native-web já nele. Na hidratação o React não troca atributo
 * de elemento que já existe, então quem usa escuro ficava com a página
 * misturada (o que veio do HTML claro, o que montou depois escuro). O
 * THEME_SCRIPT abaixo roda antes de pintar: se o tema for escuro, pinta o
 * fundo, esconde o HTML claro e manda o app montar do zero (createRoot) em vez
 * de hidratar. O app mostra a árvore no primeiro efeito (app/_layout.tsx).
 * A regra de escolha é a mesma de src/ui/theme.ts; mudou lá, muda aqui.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta
          name="description"
          content="YvY — organização de base. Propostas, checagem de fatos e ação no seu bairro."
        />

        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#FAF8F5" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#141513" />

        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="YvY" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: REGISTER_SW }} />
        <title>YvY</title>
      </head>
      <body>{children}</body>
    </html>
  );
}

const BASE_CSS = `
body { background-color: #FAF8F5; }
html.yvy-dark { color-scheme: dark; }
html.yvy-dark body { background-color: #141513; }
html.yvy-wait #root { visibility: hidden; }
`;

// Mesma regra de src/ui/theme.ts: 'dark'/'light' em localStorage['yvy-theme.txt']
// ou, sem escolha, o prefers-color-scheme. O export grava o tema claro, então
// só o escuro precisa de ajuste. __EXPO_ROUTER_HYDRATE__ é o que o expo lê
// para escolher entre hydrateRoot e createRoot; o próprio HTML do export o
// liga num <script type="module"> que roda depois deste, por isso o setter
// ignora a escrita.
const THEME_SCRIPT = `
(function () {
  var p = null;
  try { p = localStorage.getItem('yvy-theme.txt'); } catch (e) {}
  var dark = p === 'dark' || (p !== 'light' && !!window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  if (p === 'dark' || p === 'light') {
    var m = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < m.length; i++) m[i].setAttribute('content', dark ? '#141513' : '#FAF8F5');
  }
  if (!dark) return;
  document.documentElement.className += ' yvy-dark yvy-wait';
  Object.defineProperty(globalThis, '__EXPO_ROUTER_HYDRATE__', {
    configurable: true,
    get: function () { return false; },
    set: function () {}
  });
})();
`;

// O Chrome dispara o beforeinstallprompt cedo, às vezes antes do React montar.
// Fica guardado aqui para o botão "Instalar o YvY" (src/features/pwa/install.ts).
// Sem preventDefault: ele esconderia a faixa "Instalar app" que o próprio
// Chrome mostra no Android.
const REGISTER_SW = `
window.__yvyInstall = null;
window.addEventListener('beforeinstallprompt', function (e) {
  window.__yvyInstall = e;
  window.dispatchEvent(new Event('yvy-installable'));
});
if ('serviceWorker' in navigator && !/^(localhost|127\\.|192\\.168\\.)/.test(location.hostname)) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`;
