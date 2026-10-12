import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * No site/PWA, `Alert.alert` do react-native-web não abre nada: "Sair",
 * "Recusar", "Apagar"… ficavam mudos (YVY-61). Aqui ele passa a usar as
 * caixas do navegador, para todo o app de uma vez:
 *
 *  - nenhum ou 1 botão → window.alert, depois o onPress dele;
 *  - Cancelar + 1 ação → window.confirm;
 *  - várias ações → uma confirmação por ação, na ordem, até a pessoa aceitar
 *    uma (ex.: "Tirar foto agora?", depois "Escolher da galeria?").
 *
 * Chamado uma vez em app/_layout.tsx. No celular não faz nada.
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
