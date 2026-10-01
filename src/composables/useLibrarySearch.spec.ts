// src/composables/useLibrarySearch.spec.ts

import { describe, it, expect } from 'vitest'
import { ref, nextTick } from 'vue'
import { useLibrarySearch } from './useLibrarySearch'
import type { LibraryTrack } from '@/types/library'

function makeTrack(overrides: Partial<LibraryTrack> = {}): LibraryTrack {
  return {
    id: `track:${Math.random()}`,
    pluginId: 'local:Music',
    folderId: 'folder:local:Music',
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    filename: 'song.mp3',
    path: 'song.mp3',
    source: 'file://',
    ...overrides,
  } as LibraryTrack
}

/** Ждём debounce (200ms) + flush микротасков */
async function flushDebounce() {
  await new Promise((resolve) => setTimeout(resolve, 250))
  await nextTick()
}

describe('useLibrarySearch', () => {
  const THRESHOLD = 0.85

  it('пустой запрос → пустой результат', () => {
    const tracks = ref([makeTrack({ title: 'Hello' })])
    const { result } = useLibrarySearch(tracks, THRESHOLD)
    expect(result.value.tracks).toEqual([])
  })

  it('находит по точному title', async () => {
    const tracks = ref([
      makeTrack({ title: 'Karma Police' }),
      makeTrack({ title: 'Bohemian Rhapsody' }),
    ])
    const { query, result } = useLibrarySearch(tracks, THRESHOLD)
    query.value = 'Karma'
    await flushDebounce()

    expect(result.value.tracks).toHaveLength(1)
    expect(result.value.tracks[0]!.title).toBe('Karma Police')
  })

  it('находит по точному artist', async () => {
    const tracks = ref([makeTrack({ artist: 'Radiohead' }), makeTrack({ artist: 'Portishead' })])
    const { query, result } = useLibrarySearch(tracks, THRESHOLD)
    query.value = 'radiohead'
    await flushDebounce()

    expect(result.value.tracks).toHaveLength(1)
  })

  it('регистронезависим', async () => {
    const tracks = ref([makeTrack({ title: 'Karma Police' })])
    const { query, result } = useLibrarySearch(tracks, THRESHOLD)
    query.value = 'KARMA'
    await flushDebounce()

    expect(result.value.tracks).toHaveLength(1)
  })

  it('ищет по QWERTY-раскладке', async () => {
    const tracks = ref([makeTrack({ title: 'колыбельная' })])
    const { query, result } = useLibrarySearch(tracks, THRESHOLD)
    query.value = 'rjks,tkmyfz'
    await flushDebounce()

    expect(result.value.tracks).toHaveLength(1)
  })

  it('ищет по транслиту', async () => {
    const tracks = ref([makeTrack({ title: 'слот' })])
    const { query, result } = useLibrarySearch(tracks, THRESHOLD)
    query.value = 'slot'
    await flushDebounce()

    expect(result.value.tracks).toHaveLength(1)
  })

  it('группирует по artist', async () => {
    const tracks = ref([
      makeTrack({ artist: 'Radiohead', title: 'Creep' }),
      makeTrack({ artist: 'Radiohead', title: 'Karma Police' }),
      makeTrack({ artist: 'Portishead', title: 'Glory Box' }),
    ])
    const { query, result } = useLibrarySearch(tracks, THRESHOLD)
    query.value = 'radiohead'
    await flushDebounce()

    expect(result.value.groups).toHaveLength(1)
    expect(result.value.groups[0]!.artist).toBe('Radiohead')
    expect(result.value.groups[0]!.tracks).toHaveLength(2)
  })

  it('треки без artist попадают в "Без артиста"', async () => {
    const tracks = ref([makeTrack({ artist: '', title: 'Instrumental' })])
    const { query, result } = useLibrarySearch(tracks, THRESHOLD)
    query.value = 'instrumental'
    await flushDebounce()

    expect(result.value.groups[0]!.artist).toBe('Без артиста')
  })

  it('debounce', async () => {
    const tracks = ref([makeTrack({ title: 'Karma' })])
    const { query, result } = useLibrarySearch(tracks, THRESHOLD)

    query.value = 'Karma'
    // До истечения debounce — ничего
    expect(result.value.tracks).toEqual([])

    await flushDebounce()
    expect(result.value.tracks).toHaveLength(1)
  })

  it('hasQuery / hasResults', async () => {
    const tracks = ref([makeTrack({ title: 'Karma' })])
    const { query, hasQuery, hasResults } = useLibrarySearch(tracks, THRESHOLD)

    expect(hasQuery.value).toBe(false)
    expect(hasResults.value).toBe(false)

    query.value = 'Karma'
    await flushDebounce()

    expect(hasQuery.value).toBe(true)
    expect(hasResults.value).toBe(true)
  })
})
