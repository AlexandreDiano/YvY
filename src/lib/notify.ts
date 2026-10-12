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
