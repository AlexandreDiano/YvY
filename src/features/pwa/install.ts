import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Instalação do PWA (só web).
 *
 * O Chrome do Android dispara `beforeinstallprompt` uma vez, cedo, às vezes
 * antes do React montar. Por isso quem segura o evento é o script em
 * app/+html.tsx (guarda em `window.__yvyInstall`); aqui só lemos.
 *
 * iPhone não tem evento nem API: o único caminho é Compartilhar → "Adicionar
 * à Tela de Início", então lá a gente mostra os passos.
 */
export type InstallKind =
  | 'none' // celular nativo, ou já aberto como app instalado
  | 'desktop' // computador: mostrar QRCode para abrir no celular
  | 'prompt' // Android com o evento guardado: um toque instala
  | 'android' // Android sem evento (Firefox, Samsung, ou ainda carregando)
  | 'ios'; // iPhone/iPad

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type InstallWindow = Window & { __yvyInstall?: PromptEvent | null };

/** Página para onde o QRCode leva. */
export const INSTALL_PATH = '/instalar';

function detect(): InstallKind {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'none';
  const nav = navigator as Navigator & { standalone?: boolean };
  if (window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone) return 'none';
  const ua = nav.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  if (ios) return 'ios';
  if ((window as InstallWindow).__yvyInstall) return 'prompt';
  if (/Android/.test(ua)) return 'android';
  if (/Mobi/.test(ua)) return 'none';
  return 'desktop';
}

/**
 * Começa em 'none' e decide depois de montar: o HTML vem do build estático,
 * e decidir na renderização daria HTML diferente do que o navegador recebeu.
 */
export function useInstall(): { kind: InstallKind; install: () => Promise<void>; url: string } {
  const [kind, setKind] = useState<InstallKind>('none');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setKind(detect());
    const refresh = () => setKind(detect());
    window.addEventListener('yvy-installable', refresh);
    window.addEventListener('appinstalled', refresh);
    return () => {
      window.removeEventListener('yvy-installable', refresh);
      window.removeEventListener('appinstalled', refresh);
    };
  }, []);

  async function install() {
    const w = window as InstallWindow;
    const ev = w.__yvyInstall;
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice;
    // O evento só vale uma vez, aceito ou não.
    w.__yvyInstall = null;
    setKind(detect());
  }

  const url = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin + INSTALL_PATH : '';
  return { kind, install, url };
}
