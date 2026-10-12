import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Colecoes locais para o modo sem backend (ver lib/env.ts). Nao e banco:
 * e um array em AsyncStorage, suficiente para navegar e testar as telas
 * antes de existir Supabase. Em modo backend nada disto e usado.
 */
const PREFIX = 'yvy:store:';

export async function all<T>(collection: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + collection);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export async function put<T>(collection: string, rows: T[]): Promise<void> {
  await AsyncStorage.setItem(PREFIX + collection, JSON.stringify(rows));
}

export async function insert<T extends { id: string }>(collection: string, row: T): Promise<T> {
  const rows = await all<T>(collection);
  rows.unshift(row);
  await put(collection, rows);
  return row;
}

export async function patch<T extends { id: string }>(
  collection: string,
  id: string,
  changes: Partial<T>,
): Promise<T | null> {
  const rows = await all<T>(collection);
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const next = { ...rows[i]!, ...changes } as T;
  rows[i] = next;
  await put(collection, rows);
  return next;
}

export function localId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
