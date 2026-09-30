// server/src/metadata/similarity.js

/** Порог для треков без artist (только по title — строже) */
export const NO_ARTIST_THRESHOLD = 0.85

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

function normalize(value) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function jaro(a, b) {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0

  const matchDistance = Math.floor(Math.max(a.length, b.length) / 2) - 1
  const aMatches = new Array(a.length).fill(false)
  const bMatches = new Array(b.length).fill(false)

  let matches = 0

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance)
    const end = Math.min(i + matchDistance + 1, b.length)
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue
      if (a[i] !== b[j]) continue
      aMatches[i] = true
      bMatches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0

  let transpositions = 0
  let k = 0
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue
    while (!bMatches[k]) k++
    if (a[i] !== b[k]) transpositions++
    k++
  }

  transpositions = transpositions / 2

  return (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3
}

function commonPrefixLength(a, b) {
  const max = Math.min(a.length, b.length)
  let i = 0
  while (i < max && a[i] === b[i]) i++
  return i
}

function jaroWinkler(a, b) {
  const j = jaro(a, b)
  const prefixLength = Math.min(4, commonPrefixLength(a, b))
  return j + prefixLength * 0.1 * (1 - j)
}

/**
 * Сравнивает исходные метаданные трека с найденными.
 * Возвращает similarity от 0 до 1.
 * Использует max из прямого сравнения и сравнения с транслитерацией.
 */
export function metadataSimilarity(original, incoming) {
  const originalArtist = normalize(original.artist || '')
  const incomingArtist = normalize(incoming.artist || '')
  const originalTitle = normalize(original.title || '')
  const incomingTitle = normalize(incoming.title || '')

  if (!originalTitle && !incomingTitle) return 1

  let originalCombined
  let incomingCombined

  if (!originalArtist) {
    originalCombined = originalTitle
    // Если у incoming есть artist — используем его (в original title может быть "artist - title")
    incomingCombined = incomingArtist ? `${incomingArtist} ${incomingTitle}` : incomingTitle
  } else {
    originalCombined = `${originalArtist} ${originalTitle}`
    incomingCombined = incomingArtist ? `${incomingArtist} ${incomingTitle}` : incomingTitle
  }

  const direct = jaroWinkler(originalCombined, incomingCombined)
  const viaTranslit = jaroWinkler(transliterate(originalCombined), transliterate(incomingCombined))

  return Math.max(direct, viaTranslit)
}
