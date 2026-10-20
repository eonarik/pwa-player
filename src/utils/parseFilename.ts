// src/utils/parseFilename.ts

export interface GuessedMetadata {
  artist: string
  title: string
}

/**
 * Пытается угадать артиста и название из имени файла.
 *
 * Правила:
 * 1. Длинное тире с пробелами (или _) -> ` – `, ` — `, ` _ `, `_-_`, `_—` и т.д.
 * 2. Дефис с пробелами -> ` - `
 * 3. Первое вхождение всегда артист
 * 4. Остальное - тайтл
 * 5. Если разделителя нет - трек не трогаем (всё в title)
 */
export function guessMetadataFromFilename(filename: string): GuessedMetadata {
  // Убираем расширение
  const clean = filename.replace(/\.[^.]+$/, '').trim()

  // 1. Длинное тире (en-dash, em-dash) или подчеркивание с/без пробелов
  // Ищем: " – ", " — ", "_-_", "_–_", " _ ", и даже просто "—" (если это не дефис)
  // Но чтобы не ломать "my_song", ищем именно _ с пробелами вокруг или окруженное тире
  const longDashMatch = clean.match(/^(.+?)\s*(?:[–—]|(?:_\s*[-–—]\s*_)|(?:\s+_\s+))\s*(.+)$/)
  if (longDashMatch) {
    const [, left, right] = longDashMatch
    if (left && right) {
      return {
        artist: left.trim(),
        title: right.trim(),
      }
    }
  }

  // 2. Дефис с обязательными пробелами вокруг
  const hyphenMatch = clean.match(/^(.+?)\s+-\s+(.+)$/)
  if (hyphenMatch) {
    const [, left, right] = hyphenMatch
    if (left && right) {
      return {
        artist: left.trim(),
        title: right.trim(),
      }
    }
  }

  // 3. Не смогли распознать
  return {
    artist: '',
    title: clean,
  }
}
