// src/utils/hash.ts

/**
 * djb2-хеш строки → hex-строка.
 * Используется в:
 * - useClipboardWatcher (сравнение последней скопированной строки);
 * - authorColor (hue из имени автора).
 *
 * Не криптостойкий — только для детерминированного маппинга.
 */
export function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}
