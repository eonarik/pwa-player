// src/utils/deepToRaw.ts

import { toRaw } from 'vue';

/**
 * Глубокое снятие Vue Proxy (нужно для structuredClone / idb-keyval).
 *
 * FileSystemFileHandle и Blob оставляем как есть — их нельзя
 * JSON.stringify, но можно structuredClone (idb-keyval это умеет).
 *
 * Date — оставляем как есть.
 */
export function deepToRaw<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(deepToRaw) as unknown as T;
  if (typeof window !== 'undefined' && (obj instanceof FileSystemFileHandle || obj instanceof Blob)) {
    return obj;
  }

  const raw = toRaw(obj);
  const result: Record<string, unknown> = {};
  for (const key in raw) {
    result[key] = deepToRaw((raw as Record<string, unknown>)[key]);
  }
  return result as T;
}
