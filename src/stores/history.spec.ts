// src/stores/history.spec.ts
// oxlint-disable vitest/require-mock-type-parameters
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHistoryStore } from './history'
import { HISTORY_MAX_SIZE } from '@/types/history'
import type { Track } from '@/types/track'

vi.mock('@/services/persistence/HistoryPersistenceService', () => ({
  historyPersistenceService: {
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

describe('useHistoryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('изначально пусто', () => {
    const store = useHistoryStore()
    expect(store.entries).toEqual([])
    expect(store.isEmpty).toBe(true)
  })

  it('recordPlay добавляет запись', () => {
    const store = useHistoryStore()
    store.recordPlay(makeTrack())
    expect(store.entries).toHaveLength(1)
    expect(store.entries[0]!.id).toBe('track:1')
  })

  it('recordPlay обновляет существующую (upsert)', async () => {
    const store = useHistoryStore()
    store.recordPlay(makeTrack())
    await new Promise((r) => setTimeout(r, 5))
    store.recordPlay(makeTrack())

    expect(store.entries).toHaveLength(1)
    expect(store.entries[0]!.playedAt).toBeGreaterThan(store.entries[0]!.playedAt - 1)
  })

  it('uniqueHistory — по одному на trackId', () => {
    const store = useHistoryStore()
    store.recordPlay(makeTrack({ id: 'a' }))
    store.recordPlay(makeTrack({ id: 'b' }))
    store.recordPlay(makeTrack({ id: 'a' }))

    expect(store.uniqueHistory).toHaveLength(2)
  })

  it('sortedHistory — по playedAt DESC', async () => {
    const store = useHistoryStore()
    store.recordPlay(makeTrack({ id: 'a' }))
    await new Promise((r) => setTimeout(r, 5))
    store.recordPlay(makeTrack({ id: 'b' }))

    expect(store.sortedHistory[0]!.id).toBe('b')
  })

  it('обрезает до HISTORY_MAX_SIZE', () => {
    const store = useHistoryStore()
    for (let i = 0; i < HISTORY_MAX_SIZE + 5; i++) {
      store.recordPlay(makeTrack({ id: `t-${i}` }))
    }
    expect(store.entries.length).toBeLessThanOrEqual(HISTORY_MAX_SIZE)
  })

  it('clear очищает', () => {
    const store = useHistoryStore()
    store.recordPlay(makeTrack())
    store.clear()
    expect(store.entries).toEqual([])
  })

  it('сохраняет source для стриминговых треков', () => {
    const store = useHistoryStore()
    const track = makeTrack({
      id: 'zvuk:123',
      pluginId: 'zvuk',
      source: 'https://stream',
    })

    store.recordPlay(track)
    expect(store.entries[0]!.source).toBe('https://stream')
  })
})
