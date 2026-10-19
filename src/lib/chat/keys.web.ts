import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * No navegador não existe cofre do sistema: a chave fica no armazenamento do
 * site, neste navegador. Quem limpa os dados do site perde o histórico e a
 * chave (conversas novas continuam, com chave nova).
 */
const name = (userId: string) => `yvy.chat.keys.${userId}`;

export async function readSecret(userId: string): Promise<string | null> {
  return AsyncStorage.getItem(name(userId));
}

export async function writeSecret(userId: string, value: string): Promise<void> {
  await AsyncStorage.setItem(name(userId), value);
}

export async function deleteSecret(userId: string): Promise<void> {
  await AsyncStorage.removeItem(name(userId));
}

export const KEY_STORAGE_NOTE =
  'No navegador, a chave das suas conversas fica guardada neste navegador. No app instalado (APK) ela fica no cofre do aparelho.';
