import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * No site/PWA o `Alert.alert` do react-native-web não abre nada, e "Sair",
 * "Recusar", "Apagar" etc. ficavam mudos (YVY-61). Aqui ele passa a usar as
 * caixas do navegador no app todo:
 *
 *   nenhum ou 1 botão: window.alert, depois o onPress do botão;
 *   Cancelar + 1 ação: window.confirm;
 *   várias ações: uma confirmação por ação, em ordem, até a pessoa aceitar
 *   uma (ex.: "Tirar foto agora?" e depois "Escolher da galeria?").
 *
 * É chamado uma vez no app/_layout.tsx. No celular não faz nada.
 */
export function installWebAlert(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = message ? `${title}\n\n${message}` : title;
    const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
    const cancel = (buttons ?? []).find((b) => b.style === 'cancel');

    if (actions.length <= 1 && !cancel) {
      window.alert(text);
      actions[0]?.onPress?.();
      return;
    }
    if (actions.length === 1) {
      if (window.confirm(text)) actions[0]!.onPress?.();
      else cancel?.onPress?.();
      return;
    }
    for (const [i, b] of actions.entries()) {
      const ask = i === 0 ? `${text}\n\n${b.text}?` : `${b.text}?`;
      if (window.confirm(ask)) {
        b.onPress?.();
        return;
      }
    }
    cancel?.onPress?.();
  };
}
