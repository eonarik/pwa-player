// server/src/metadata/parseTitle.js

/**
 * Пытается угадать артиста и название из строки.
 * Повторяет логику фронтенд-функции guessMetadataFromFilename.
 *
 * Правила:
 * 1. Длинное тире с пробелами (или _) -> ` – `, ` — `, ` _ `, `_-_`, `_—` и т.д.
 * 2. Дефис с пробелами -> ` - `
 * 3. Первое вхождение всегда артист
 * 4. Остальное - тайтл
 * 5. Если разделителя нет - трек не трогаем (всё в title)
 */
export function parseArtistAndTitle(input) {
  const clean = input.trim();

  // 1. Длинное тире (en-dash, em-dash) или подчеркивание с/без пробелов
  const longDashMatch = clean.match(/^(.+?)\s*(?:[–—]|(?:_\s*[-–—]\s*_)|(?:\s+_\s+))\s*(.+)$/);
  if (longDashMatch) {
    const [, left, right] = longDashMatch;
    if (left && right) {
      return {
        artist: left.trim(),
        title: right.trim(),
      };
    }
  }

  // 2. Дефис с обязательными пробелами вокруг
  const hyphenMatch = clean.match(/^(.+?)\s+-\s+(.+)$/);
  if (hyphenMatch) {
    const [, left, right] = hyphenMatch;
    if (left && right) {
      return {
        artist: left.trim(),
        title: right.trim(),
      };
    }
  }

  // 3. Не смогли распознать
  return {
    artist: '',
    title: clean,
  };
}
