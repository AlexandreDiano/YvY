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
 * As cores aqui são fixas (areia/creme) porque o HTML sai no build, antes de
 * saber o tema de quem abre. O escuro entra quando o app carrega.
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
@media (prefers-color-scheme: dark) { body { background-color: #141513; } }
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
