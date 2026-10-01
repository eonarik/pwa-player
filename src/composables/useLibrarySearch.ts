// src/composables/useLibrarySearch.ts

import { computed, ref, watch, type Ref } from 'vue'
import { fuzzyMatch } from '@/utils/fuzzyMatch'
import { layoutVariants } from '@/utils/layout'
import type { LibraryTrack } from '@/types/library'

const DEBOUNCE_MS = 200
/** Минимальная длина токена для поиска */
const MIN_TOKEN_LENGTH = 3
/** Минимальная длина слова для fuzzy-сравнения */
const MIN_WORD_LENGTH = 4
/** Минимальная длина слова, чтобы оно считалось «обратным префиксом» токена */
const MIN_REVERSE_PREFIX_LENGTH = 4

export interface ArtistGroup {
  artist: string
  tracks: LibraryTrack[]
}

export interface SearchResult {
  tracks: LibraryTrack[]
  groups: ArtistGroup[]
}

/**
 * Поиск по трекам: fuzzy-match по title + artist, с учётом раскладки QWERTY↔ЙЦУКЕН
 * и транслитерации. Группирует результаты по артистам.
 */
export function useLibrarySearch(source: Ref<LibraryTrack[]>, threshold = 0.5) {
  const query = ref('')
  const debouncedQuery = ref('')

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  watch(query, (value) => {
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debouncedQuery.value = value
      debounceTimer = null
    }, DEBOUNCE_MS)
  })

  function getWords(track: LibraryTrack): string[] {
    const haystacks = [...layoutVariants(track.title), ...layoutVariants(track.artist ?? '')]
    return haystacks.flatMap((h) => h.split(/\s+/)).filter(Boolean)
  }

  /** Совпадает ли токен с одним словом */
  function tokenMatchesWord(token: string, word: string): boolean {
    if (word === token) return true
    if (word.startsWith(token)) return true
    if (word.length >= MIN_REVERSE_PREFIX_LENGTH && token.startsWith(word)) return true
    if (word.length < MIN_WORD_LENGTH) return false
    return fuzzyMatch(token, word) >= threshold
  }

  function trackMatches(track: LibraryTrack, tokens: string[]): boolean {
    const words = getWords(track)
    if (words.length === 0) return false

    return tokens.some((token) => {
      if (token.length < MIN_TOKEN_LENGTH) return false
      return words.some((word) => tokenMatchesWord(token, word))
    })
  }

  function trackScore(track: LibraryTrack, tokens: string[]): number {
    const words = getWords(track)
    if (words.length === 0) return 0

    let best = 0
    for (const token of tokens) {
      if (token.length < MIN_TOKEN_LENGTH) continue
      for (const word of words) {
        if (word === token || word.startsWith(token)) {
          return 1
        }
        if (word.length >= MIN_REVERSE_PREFIX_LENGTH && token.startsWith(word)) {
          return 1
        }
        if (word.length < MIN_WORD_LENGTH) continue
        const score = fuzzyMatch(token, word)
        if (score > best) best = score
      }
    }
    return best
  }

  const result = computed<SearchResult>(() => {
    const q = debouncedQuery.value.trim().toLowerCase()
    if (!q) {
      return { tracks: [], groups: [] }
    }

    const tokens = q.split(/\s+/).filter(Boolean)

    const matched = source.value
      .filter((track) => trackMatches(track, tokens))
      .map((track) => ({ track, score: trackScore(track, tokens) }))

    matched.sort((a, b) => b.score - a.score)

    const tracks = matched.map((m) => m.track)

    // Группировка по артистам
    const map = new Map<string, LibraryTrack[]>()
    for (const track of tracks) {
      const artist = track.artist?.trim() || 'Без артиста'
      const list = map.get(artist)
      if (list) {
        list.push(track)
      } else {
        map.set(artist, [track])
      }
    }

    const groups: ArtistGroup[] = Array.from(map, ([artist, tracks]) => ({
      artist,
      tracks,
    }))

    return { tracks, groups }
  })

  const hasQuery = computed(() => debouncedQuery.value.trim().length > 0)
  const hasResults = computed(() => result.value.tracks.length > 0)

  return {
    query,
    hasQuery,
    hasResults,
    result,
  }
}
