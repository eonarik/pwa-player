// src/utils/parseFilename.ts

export interface GuessedMetadata {
  artist: string;
  title: string;
}

export function guessMetadataFromFilename(filename: string, parentFolder?: string): GuessedMetadata {
  const clean = filename.replace(/\.[^.]+$/, '').trim();

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

  // 3. Если не нашли в имени файла, но есть родительская папка (и это не generic-название)
  if (parentFolder) {
    const folderLower = parentFolder.toLowerCase();
    const isGeneric = /^\d+$/.test(folderLower) || ['music', 'nostalgy', 'downloads', 'music'].includes(folderLower);
    if (!isGeneric) {
      return {
        artist: parentFolder.trim(),
        title: clean,
      };
    }
  }

  // 4. Не смогли распознать
  return {
    artist: '',
    title: clean,
  };
}
