// src/utils/fuzzyMatch.ts

function jaro(a: string, b: string): number {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0

  const matchDistance = Math.floor(Math.max(a.length, b.length) / 2) - 1
  const aMatches = new Array<boolean>(a.length).fill(false)
  const bMatches = new Array<boolean>(b.length).fill(false)

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

function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length)
  let i = 0
  while (i < max && a[i] === b[i]) i++
  return i
}

/** Jaro-Winkler similarity: 0..1 */
export function fuzzyMatch(a: string, b: string): number {
  const j = jaro(a, b)
  const prefixLength = Math.min(4, commonPrefixLength(a, b))
  return j + prefixLength * 0.1 * (1 - j)
}
