// server/src/metadata/similarity.js

import { token_set_ratio, token_sort_ratio } from 'fuzzball'

/** Порог для треков без artist (только по title — строже) */
export const NO_ARTIST_THRESHOLD = 0.85

/** Минимальное similarity artist, чтобы считать его «совпавшим» */
const ARTIST_MATCH_THRESHOLD = 0.5

/** Веса при комбинации: title важнее */
const TITLE_WEIGHT = 0.8
const ARTIST_WEIGHT = 0.2

/**
 * Если artist явно разный — снижаем общий скор, обнуляя вклад artist
 * и оставляя только title. Иначе — взвешенная сумма.
 */
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

/**
 * token_set_ratio с защитой от шума на пустом пересечении.
 *
 * fuzzball возвращает ~0.14 для строк без общих токенов (например
 * 'aaa bbb' vs 'xxx yyy'), потому что внутри использует ratio и ловит
 * совпадения по длине/разделителям. Здесь мы явно проверяем пересечение
 * множеств токенов и возвращаем 0, если его нет.
 */
function hasTokenIntersection(a, b) {
  const tokensA = new Set(a.split(/\s+/).filter(Boolean))
  const tokensB = new Set(b.split(/\s+/).filter(Boolean))
  if (tokensA.size === 0 || tokensB.size === 0) return false
  for (const t of tokensA) {
    if (tokensB.has(t)) return true
  }
  return false
}

function safeTokenSetRatio(a, b) {
  if (!hasTokenIntersection(a, b)) return 0
  return token_set_ratio(a, b)
}

function safeTokenSortRatio(a, b) {
  if (!hasTokenIntersection(a, b)) return 0
  return token_sort_ratio(a, b)
}

/**
 * Similarity artist или title:
 * max из прямого token_set/token_sort и token_set на транслите (RU→EN).
 * Возвращает [0, 1].
 */
function fieldSimilarity(a, b) {
  if (!a && !b) return 0
  if (a === b) return 1

  const direct = Math.max(safeTokenSetRatio(a, b), safeTokenSortRatio(a, b))

  const translitA = transliterate(a)
  const translitB = transliterate(b)
  const viaTranslit = safeTokenSetRatio(translitA, translitB)

  return Math.max(direct, viaTranslit) / 100
}

/**
 * Сравнивает исходные метаданные трека с найденными.
 * Возвращает similarity от 0 до 1.
 *
 * Логика:
 * - artist и title сравниваются раздельно.
 * - title — главный сигнал (0.8).
 * - artist — усилитель (0.2).
 * - Если оба artist непустые и их similarity < 0.5 — считаем artist
 *   «явно разным» и обнуляем его вклад, оставляя только title со штрафом.
 *
 * Примеры:
 * - «Radiohead Karma Police» vs «Radiohead Creep» → ~0.2 (artist совпал, title разный).
 * - «Radiohead Karma Police» vs «Karma Polise» → ~0.9 (опечатка в title).
 * - «AAA BBB» vs «XXX YYY» → 0 (нет общих токенов).
 * - «Ночные снайперы» vs «Nochnye Snaypery» → ~1.0 (транслит).
 */
export function metadataSimilarity(original, incoming) {
  const origArtist = normalize(original.artist)
  const incArtist = normalize(incoming.artist)
  const origTitle = normalize(original.title)
  const incTitle = normalize(incoming.title)

  if (!origTitle && !incTitle) return 1

  const titleSim = fieldSimilarity(origTitle, incTitle)

  // Если artist нет с одной стороны — не штрафуем, считаем только title
  if (!origArtist || !incArtist) {
    return titleSim
  }

  const artistSim = fieldSimilarity(origArtist, incArtist)

  // artist явно разный — не даём ему усиливать результат
  if (artistSim < ARTIST_MATCH_THRESHOLD) {
    return titleSim * MISMATCHED_ARTIST_PENALTY
  }

  return titleSim * TITLE_WEIGHT + artistSim * ARTIST_WEIGHT
}
