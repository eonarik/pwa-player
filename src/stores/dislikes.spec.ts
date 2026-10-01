// oxlint-disable vitest/require-mock-type-parameters
// src/stores/dislikes.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDislikesStore } from './dislikes'
import type { Track } from '@/types/track'

// Мок persistence — чтобы не писать в IDB
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
    source: 'file://',
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

  it('dislike добавляет трек', () => {
    const store = useDislikesStore()
    const track = makeTrack()
    store.dislike(track)

    expect(store.entries).toHaveLength(1)
    expect(store.entries[0]!.trackId).toBe('track:1')
    expect(store.isDisliked('track:1')).toBe(true)
  })

  it('dislike идемпотентен', () => {
    const store = useDislikesStore()
    const track = makeTrack()
    store.dislike(track)
    store.dislike(track)
    expect(store.entries).toHaveLength(1)
  })

  it('undislike удаляет', () => {
    const store = useDislikesStore()
    store.dislike(makeTrack())
    store.undislike('track:1')
    expect(store.entries).toHaveLength(0)
    expect(store.isDisliked('track:1')).toBe(false)
  })

  it('toggleDislike ставит и снимает', () => {
    const store = useDislikesStore()
    const track = makeTrack()

    const first = store.toggleDislike(track)
    expect(first).toBe(true)
    expect(store.isDisliked('track:1')).toBe(true)

    const second = store.toggleDislike(track)
    expect(second).toBe(false)
    expect(store.isDisliked('track:1')).toBe(false)
  })

  it('dislikedIds — Set', () => {
    const store = useDislikesStore()
    store.dislike(makeTrack({ id: 'a' }))
    store.dislike(makeTrack({ id: 'b' }))
    expect(store.dislikedIds.has('a')).toBe(true)
    expect(store.dislikedIds.has('b')).toBe(true)
    expect(store.dislikedIds.has('c')).toBe(false)
  })

  it('sortedEntries — по убыванию dislikedAt', async () => {
    const store = useDislikesStore()
    const t1 = makeTrack({ id: 'a' })
    const t2 = makeTrack({ id: 'b' })

    store.dislike(t1)
    await new Promise((r) => setTimeout(r, 5))
    store.dislike(t2)

    expect(store.sortedEntries[0]!.trackId).toBe('b')
  })

  it('clear очищает всё', () => {
    const store = useDislikesStore()
    store.dislike(makeTrack())
    store.clear()
    expect(store.entries).toEqual([])
  })
})
