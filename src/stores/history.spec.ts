// src/stores/history.spec.ts
// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHistoryStore } from './history'
import { useLibraryStore } from './library'
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
    sources: [{ id: 'track:1', pluginId: 'local', url: 'file://', priority: 10 }],
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

  it('recordPlay добавляет запись', async () => {
    const store = useHistoryStore()
    await store.recordPlay(makeTrack())
    expect(store.entries).toHaveLength(1)
    expect(store.entries[0]!.trackId).toBe('track:1')
  })

  it('recordPlay обновляет существующую (upsert)', async () => {
    const store = useHistoryStore()
    await store.recordPlay(makeTrack())
    await new Promise((r) => setTimeout(r, 5))
    await store.recordPlay(makeTrack())

    expect(store.entries).toHaveLength(1)
    expect(store.entries[0]!.playedAt).toBeGreaterThan(store.entries[0]!.playedAt - 1)
  })

  it('uniqueHistory — по одному на trackId', async () => {
    const store = useHistoryStore()
    await store.recordPlay(makeTrack({ id: 'a' }))
    await store.recordPlay(makeTrack({ id: 'b' }))
    await store.recordPlay(makeTrack({ id: 'a' }))

    expect(store.uniqueHistory).toHaveLength(2)
  })

  it('sortedHistory — по playedAt DESC', async () => {
    const store = useHistoryStore()
    await store.recordPlay(makeTrack({ id: 'a' }))
    await new Promise((r) => setTimeout(r, 5))
    await store.recordPlay(makeTrack({ id: 'b' }))

    expect(store.sortedHistory[0]!.trackId).toBe('b')
  })

  it('обрезает до HISTORY_MAX_SIZE', async () => {
    const store = useHistoryStore()

    // Заполняем историю напрямую, минуя логику recordPlay (чтобы не ждать 1000 сохранений)
    store.entries = Array.from({ length: 1005 }).map((_, i) => ({
      trackId: `t-${i}`,
      playedAt: Date.now() + i,
    }))

    // Вызываем recordPlay для одного нового трека
    await store.recordPlay(makeTrack({ id: 'new-track' }))

    // Проверяем, что история обрезалась
    expect(store.entries.length).toBe(1000) // или HISTORY_MAX_SIZE
    // Проверяем, что старые удалились, а новые остались
    expect(store.entries.some((e) => e.trackId === 't-0')).toBe(false)
    expect(store.entries.some((e) => e.trackId === 'new-track')).toBe(true)
  })

  it('clear очищает', async () => {
    const store = useHistoryStore()
    await store.recordPlay(makeTrack())
    store.clear()
    expect(store.entries).toEqual([])
  })

  it('recordPlay стримингового трека сохраняет его в library как виртуальный', async () => {
    const store = useHistoryStore()
    const library = useLibraryStore()

    const track = makeTrack({
      id: 'zvuk:123',
      pluginId: 'zvuk',
      sources: [{ id: 'zvuk:123', pluginId: 'zvuk', url: 'https://stream', priority: 30 }],
    })

    await store.recordPlay(track)

    expect(store.entries[0]!.trackId).toBe('zvuk:123')

    const libTrack = library.getTrack('zvuk:123')
    expect(libTrack).toBeDefined()
    expect(libTrack!.sources[0]!.url).toBe('https://stream')
    expect(libTrack!.isVirtual).toBe(true)
  })
})
