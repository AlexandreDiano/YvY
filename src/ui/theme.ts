import { File, Paths } from 'expo-file-system';
import { Appearance, Platform } from 'react-native';

/**
 * Claro, escuro ou igual ao celular.
 *
 * As cores entram nos StyleSheet.create na hora em que cada arquivo carrega,
 * então o tema tem que estar decidido antes, com leitura síncrona. AsyncStorage
 * não serve; um arquivinho com expo-file-system (textSync) serve. Trocar o
 * tema só vale quando reabre o app.
 */
export type ThemePref = 'system' | 'light' | 'dark';

const FILE = 'yvy-theme.txt';

function file(): File | null {
  if (Platform.OS === 'web') return null;
  try {
    return new File(Paths.document, FILE);
  } catch {
    return null;
  }
}

export function readThemePref(): ThemePref {
  try {
    if (Platform.OS === 'web') {
      const v = globalThis.localStorage?.getItem(FILE);
      return v === 'light' || v === 'dark' ? v : 'system';
    }
    const f = file();
    if (!f?.exists) return 'system';
    const v = f.textSync().trim();
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function saveThemePref(pref: ThemePref): void {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(FILE, pref);
      return;
    }
    const f = file();
    if (!f) return;
    if (!f.exists) f.create();
    f.write(pref);
  } catch {
    // sem disco, fica no padrão do celular
  }
}

/** Tema em uso nesta abertura do app. */
export const themePref: ThemePref = readThemePref();
export const isDark: boolean =
  themePref === 'dark' || (themePref === 'system' && Appearance.getColorScheme() === 'dark');
