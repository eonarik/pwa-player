// server/src/metadata/similarity.js

import { jaroWinkler } from './jaroWinkler.js'

export const NO_ARTIST_THRESHOLD = 0.85

const ARTIST_EXACT_THRESHOLD = 0.8 // Высокое совпадение (одно и то же)
const ARTIST_LOOSE_THRESHOLD = 0.4 // Ниже этого — разные артисты
const TITLE_WEIGHT = 0.8
const ARTIST_WEIGHT = 0.2
const MISMATCHED_ARTIST_PENALTY = 0.2

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

  const direct = jaroWinkler(a, b)
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

  const artistSim = fieldSimilarity(origArtist, incArtist)

  // 1. Артисты вообще разные (##### vs Mishka)
  if (artistSim < ARTIST_LOOSE_THRESHOLD) {
    return titleSim * MISMATCHED_ARTIST_PENALTY
  }

  // 2. Артисты похожи, но не идеально — не штрафуем, но даем меньший вес
  if (artistSim < ARTIST_EXACT_THRESHOLD) {
    // Взвешиваем: title * 0.9 + artist * 0.1
    return titleSim * 0.9 + artistSim * 0.1
  }

  // 3. Артисты совпадают отлично
  return titleSim * TITLE_WEIGHT + artistSim * ARTIST_WEIGHT
}
