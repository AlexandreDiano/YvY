import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cache offline-first. Principio do contexto (secao 1.4 / risco "internet no
 * dia 25"): o app mostra o ultimo conteudo conhecido quando a rede cai.
 *
 * Dado pessoal de terceiro nao entra aqui.
 */
const PREFIX = 'yvy:cache:';

type Entry<T> = { at: number; data: T };

export async function readCache<T>(key: string, maxAgeMs = 1000 * 60 * 60 * 24): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    if (Date.now() - entry.at > maxAgeMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), data } satisfies Entry<T>));
  } catch {
    // cache cheio ou storage bloqueado: seguir sem cache, nunca quebrar a tela
  }
}

export async function clearCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const ours = keys.filter((k) => k.startsWith(PREFIX));
  if (ours.length) await AsyncStorage.multiRemove(ours);
}

/**
 * Busca na rede e cai no cache quando falha. Devolve tambem a origem, para a
 * tela poder avisar "mostrando dados salvos".
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  maxAgeMs?: number,
): Promise<{ data: T | null; stale: boolean }> {
  try {
    const data = await fetcher();
    await writeCache(key, data);
    return { data, stale: false };
  } catch (err) {
    const cached = await readCache<T>(key, maxAgeMs);
    if (cached !== null) return { data: cached, stale: true };
    throw err;
  }
}
