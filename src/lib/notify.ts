import { Alert, Platform } from 'react-native';

/**
 * Aviso de um botão só ("OK") que funciona também no site/PWA.
 * `Alert.alert` do react-native-web não faz nada: no navegador a mensagem
 * sumiria calada.
 */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/**
 * Pergunta "tem certeza?" com Cancelar + uma ação, também no site/PWA
 * (`window.confirm`; o Alert com botões do react-native-web não abre nada).
 */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
  destructive = false,
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
