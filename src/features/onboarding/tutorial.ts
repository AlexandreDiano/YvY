import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Marca "falta ver o tutorial" neste aparelho. Quem cadastra e precisa
 * confirmar o e-mail só ganha perfil no primeiro login, então o tutorial
 * espera até lá. Guarda só um "1", nada da pessoa.
 */
const KEY = 'yvy.tutorial.pending';

export async function markTutorialPending() {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // sem armazenamento a pessoa só não vê o tutorial; ele continua no Perfil
  }
}

/** Lê e apaga a marca: o tutorial aparece uma vez só. */
export async function takeTutorialPending(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v) await AsyncStorage.removeItem(KEY);
    return v === '1';
  } catch {
    return false;
  }
}

/**
 * Marca "este aparelho viu a pessoa pendente". Quando ela aparece confirmada
 * (agora ou numa próxima abertura), o tour mostra só o que a confirmação
 * liberou. Também só um "1".
 */
const AWAIT_KEY = 'yvy.tutorial.awaiting-confirm';

export async function markAwaitingConfirm() {
  try {
    await AsyncStorage.setItem(AWAIT_KEY, '1');
  } catch {
    // sem armazenamento só não tem o tour da confirmação
  }
}

/** Lê e apaga a marca da confirmação. */
export async function takeAwaitingConfirm(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(AWAIT_KEY);
    if (v) await AsyncStorage.removeItem(AWAIT_KEY);
    return v === '1';
  } catch {
    return false;
  }
}
