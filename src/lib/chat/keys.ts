import * as SecureStore from 'expo-secure-store';

/**
 * Chaves do aparelho no cofre do sistema (Keystore no Android, Keychain no
 * iOS), por conta: duas contas no mesmo celular não dividem chave.
 */
const name = (userId: string) => `yvy.chat.keys.${userId}`;

export async function readSecret(userId: string): Promise<string | null> {
  return SecureStore.getItemAsync(name(userId));
}

export async function writeSecret(userId: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(name(userId), value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function deleteSecret(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(name(userId));
}

/** No APK a chave privada fica no cofre do aparelho. */
export const KEY_STORAGE_NOTE = 'A chave das suas conversas fica no cofre deste aparelho.';
