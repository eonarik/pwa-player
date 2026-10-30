// server/src/shared/aliases.js

/**
 * Глобальный словарь алиасов для поиска метаданных.
 * Используется всеми провайдерами (iTunes, Deezer, Zvuk).
 *
 * Ключ: как написано в файле/тегах (в нижнем регистре).
 * Значение: массив альтернативных вариантов для поиска.
 */
export const ARTIST_ALIASES = {
  '#####': ['5diez'],
};

/**
 * Возвращает массив всех вариантов для поиска (оригинал + алиасы).
 * Убирает дубликаты.
 */
export function getArtistSearchVariants(artist) {
  const original = (artist || '').trim();
  if (!original) return [];

  const variants = new Set([original]);
  const lowerOriginal = original.toLowerCase();

  for (const [key, values] of Object.entries(ARTIST_ALIASES)) {
    if (lowerOriginal === key.toLowerCase()) {
      for (const val of values) {
        variants.add(val);
      }
    }
  }

  return Array.from(variants);
}
