// src/stores/dislikes.spec.ts
// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDislikesStore } from './dislikes'
import { useLibraryStore } from './library'
import type { Track } from '@/types/track'

vi.mock('@/services/persistence/DislikesPersistenceService', () => ({
  dislikesPersistenceService: {
    load: vi.fn(async () => null),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}))

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track:1',
    pluginId: 'local',
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    sources: [{ id: 'track:1', pluginId: 'local', url: 'file://', priority: 10 }],
    filename: 'song.mp3',
    ...overrides,
  } as Track
}

describe('useDislikesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('изначально пусто', () => {
    const store = useDislikesStore()
    expect(store.entries).toEqual([])
    expect(store.isDisliked('track:1')).toBe(false)
  })

  it('dislike добавляет трек', async () => {
    const store = useDislikesStore()
    const track = makeTrack()
    await store.dislike(track)

    expect(store.entries).toHaveLength(1)
    expect(store.entries[0]!.trackId).toBe('track:1')
    expect(store.isDisliked('track:1')).toBe(true)
  })

  it('dislike идемпотентен', async () => {
    const store = useDislikesStore()
    const track = makeTrack()
    await store.dislike(track)
    await store.dislike(track)
    expect(store.entries).toHaveLength(1)
  })

  it('undislike удаляет', async () => {
    const store = useDislikesStore()
    await store.dislike(makeTrack())
    store.undislike('track:1')
    expect(store.entries).toHaveLength(0)
    expect(store.isDisliked('track:1')).toBe(false)
  })

  it('toggleDislike ставит и снимает', async () => {
    const store = useDislikesStore()
    const track = makeTrack()

    const first = await store.toggleDislike(track)
    expect(first).toBe(true)
    expect(store.isDisliked('track:1')).toBe(true)

    const second = await store.toggleDislike(track)
    expect(second).toBe(false)
    expect(store.isDisliked('track:1')).toBe(false)
  })

  it('dislikedIds — Set', async () => {
    const store = useDislikesStore()
    await store.dislike(makeTrack({ id: 'a' }))
    await store.dislike(makeTrack({ id: 'b' }))
    expect(store.dislikedIds.has('a')).toBe(true)
    expect(store.dislikedIds.has('b')).toBe(true)
    expect(store.dislikedIds.has('c')).toBe(false)
  })

  it('sortedEntries — по убыванию dislikedAt', async () => {
    const store = useDislikesStore()
    const t1 = makeTrack({ id: 'a' })
    const t2 = makeTrack({ id: 'b' })

    await store.dislike(t1)
    await new Promise((r) => setTimeout(r, 5))
    await store.dislike(t2)

    expect(store.sortedEntries[0]!.trackId).toBe('b')
  })

  it('clear очищает всё', async () => {
    const store = useDislikesStore()
    await store.dislike(makeTrack())
    store.clear()
    expect(store.entries).toEqual([])
  })

  it('dislike стримингового трека сохраняет его в library как виртуальный', async () => {
    const store = useDislikesStore()
    const library = useLibraryStore()

    const track = makeTrack({
      id: 'zvuk:123',
      pluginId: 'zvuk',
      sources: [{ id: 'zvuk:123', pluginId: 'zvuk', url: 'https://stream', priority: 30 }],
    })

    await store.dislike(track)

    expect(store.entries[0]!.trackId).toBe('zvuk:123')

    const libTrack = library.getTrack('zvuk:123')
    expect(libTrack).toBeDefined()
    expect(libTrack!.sources[0]!.url).toBe('https://stream')
    expect(libTrack!.isVirtual).toBe(true)
  })
})
