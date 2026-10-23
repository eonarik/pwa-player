// server/src/metadata/similarity.js

import { jaroWinkler } from './jaroWinkler.js'

export const NO_ARTIST_THRESHOLD = 0.85

const ARTIST_MATCH_THRESHOLD = 0.5
const TITLE_WEIGHT = 0.8
const ARTIST_WEIGHT = 0.2
const MISMATCHED_ARTIST_PENALTY = 0.5

const TRANSLIT_TABLE = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

function transliterate(value) {
  let result = ''
  for (const char of value) {
    const mapped = TRANSLIT_TABLE[char]
    result += mapped !== undefined ? mapped : char
  }
  return result
}

function normalize(s) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function fieldSimilarity(a, b) {
  if (!a && !b) return 0
  if (a === b) return 1

  // Прямое сравнение
  const direct = jaroWinkler(a, b)

  // Сравнение через транслит (чтобы "слот" и "slot" совпали)
  const translitA = transliterate(a)
  const translitB = transliterate(b)
  const viaTranslit = jaroWinkler(translitA, translitB)

  return Math.max(direct, viaTranslit)
}

export function metadataSimilarity(original, incoming) {
  const origArtist = normalize(original.artist)
  const incArtist = normalize(incoming.artist)
  const origTitle = normalize(original.title)
  const incTitle = normalize(incoming.title)

  if (!origTitle && !incTitle) return 1

  const titleSim = fieldSimilarity(origTitle, incTitle)

  // Если artist нет с одной стороны — считаем только title
  if (!origArtist || !incArtist) {
    return titleSim
  }

  // Если артист состоит только из символов (#####), Jaro-Winkler сам даст низкий скор.
  // Мы не игнорируем его, а честно сравниваем.
  const artistSim = fieldSimilarity(origArtist, incArtist)

  if (artistSim < ARTIST_MATCH_THRESHOLD) {
    return titleSim * MISMATCHED_ARTIST_PENALTY
  }

  return titleSim * TITLE_WEIGHT + artistSim * ARTIST_WEIGHT
}
