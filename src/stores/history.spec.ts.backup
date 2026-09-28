// src/stores/history.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { useHistoryStore } from './history'
import { HISTORY_MAX_SIZE } from '@/types/history'
import type { PlayHistoryEntry } from '@/types/history'
import type { Track } from '@/types/track'

const { mockPersistence } = vi.hoisted(() => ({
  mockPersistence: {
    save: vi.fn<(entries: PlayHistoryEntry[]) => Promise<void>>(() => Promise.resolve()),
    load: vi.fn<() => Promise<PlayHistoryEntry[] | null>>(() => Promise.resolve(null)),
    clear: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  },
}))

vi.mock('@/services/persistence/HistoryPersistenceService', () => ({
  historyPersistenceService: mockPersistence,
}))

// --- Вспомогательные фабрики ------------------------------------------

function makeTrack(id: string, overrides: Partial<Track> = {}): Track {
  return {
    id,
    pluginId: 'local',
    source: `https://example.com/${id}.mp3`,
    filename: `${id}.mp3`,
    title: `Track ${id}`,
    artist: 'Artist',
    album: 'Album',
    ...overrides,
  }
}

async function flushWatch() {
  await nextTick()
  await nextTick()
}

describe('useHistoryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockPersistence.load.mockResolvedValue(null)
    mockPersistence.save.mockResolvedValue(undefined)
    mockPersistence.clear.mockResolvedValue(undefined)
  })

  describe('пустое состояние', () => {
    it('entries = []', () => {
      const store = useHistoryStore()
      expect(store.entries).toEqual([])
    })

    it('sortedHistory = []', () => {
      const store = useHistoryStore()
      expect(store.sortedHistory).toEqual([])
    })

    it('uniqueHistory = []', () => {
      const store = useHistoryStore()
      expect(store.uniqueHistory).toEqual([])
    })

    it('isEmpty = true', () => {
      const store = useHistoryStore()
      expect(store.isEmpty).toBe(true)
    })
  })

  describe('recordPlay', () => {
    it('добавляет новую запись', () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))

      expect(store.entries.length).toBe(1)
      expect(store.entries[0]!.trackId).toBe('t1')
      expect(store.entries[0]!.title).toBe('Track t1')
      expect(store.entries[0]!.artist).toBe('Artist')
      expect(store.entries[0]!.album).toBe('Album')
    })

    it('сохраняет pluginId из трека', () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1', { pluginId: 'yandex' }))
      expect(store.entries[0]!.pluginId).toBe('yandex')
    })

    it('сохраняет remotePath, если он есть', () => {
      const store = useHistoryStore()
      const track = makeTrack('t1') as Track & { remotePath?: string }
      track.remotePath = 'disk:/Music/a.mp3'

      store.recordPlay(track)

      expect(store.entries[0]!.remotePath).toBe('disk:/Music/a.mp3')
    })

    it('не сохраняет remotePath, если его нет', () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      expect(store.entries[0]!.remotePath).toBeUndefined()
    })

    it('проставляет playedAt', () => {
      const store = useHistoryStore()
      const before = Date.now()
      store.recordPlay(makeTrack('t1'))
      const after = Date.now()

      const playedAt = store.entries[0]!.playedAt
      expect(playedAt).toBeGreaterThanOrEqual(before)
      expect(playedAt).toBeLessThanOrEqual(after)
    })

    it('не создаёт дубликат при повторном recordPlay того же трека', () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      store.recordPlay(makeTrack('t1'))

      expect(store.entries.length).toBe(1)
    })

    it('обновляет playedAt при повторном recordPlay', async () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      const firstPlayedAt = store.entries[0]!.playedAt

      await new Promise((r) => setTimeout(r, 5))
      store.recordPlay(makeTrack('t1'))

      expect(store.entries[0]!.playedAt).toBeGreaterThan(firstPlayedAt)
    })

    it('обновляет snapshot при повторном recordPlay (title мог измениться)', () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1', { title: 'Old title' }))
      store.recordPlay(makeTrack('t1', { title: 'New title' }))

      expect(store.entries.length).toBe(1)
      expect(store.entries[0]!.title).toBe('New title')
    })

    it('разные треки → разные записи', () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      store.recordPlay(makeTrack('t2'))

      expect(store.entries.length).toBe(2)
      expect(store.entries.map((e) => e.trackId).sort()).toEqual(['t1', 't2'])
    })
  })

  describe('вытеснение при превышении HISTORY_MAX_SIZE', () => {
    it('не превышает HISTORY_MAX_SIZE после множества записей', () => {
      const store = useHistoryStore()
      for (let i = 0; i < HISTORY_MAX_SIZE + 5; i++) {
        store.recordPlay(makeTrack(`t${i}`))
      }
      expect(store.entries.length).toBe(HISTORY_MAX_SIZE)
    })

    it('вытесняет самые старые по playedAt', async () => {
      const store = useHistoryStore()

      for (let i = 0; i < HISTORY_MAX_SIZE; i++) {
        store.recordPlay(makeTrack(`old${i}`))
        if (i % 100 === 0) await new Promise((r) => setTimeout(r, 1))
      }

      const firstTrackId = store.entries[0]!.trackId
      expect(firstTrackId).toBe('old0')

      store.recordPlay(makeTrack('new'))

      const ids = store.entries.map((e) => e.trackId)
      expect(ids).not.toContain('old0')
      expect(ids).toContain('new')
      expect(store.entries.length).toBe(HISTORY_MAX_SIZE)
    })

    it('не вытесняет, если записей меньше лимита', () => {
      const store = useHistoryStore()
      for (let i = 0; i < 10; i++) {
        store.recordPlay(makeTrack(`t${i}`))
      }
      expect(store.entries.length).toBe(10)
    })
  })

  describe('sortedHistory', () => {
    it('сортирует по playedAt desc (свежие первыми)', async () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      await new Promise((r) => setTimeout(r, 5))
      store.recordPlay(makeTrack('t2'))
      await new Promise((r) => setTimeout(r, 5))
      store.recordPlay(makeTrack('t3'))

      const sorted = store.sortedHistory
      expect(sorted.map((e) => e.trackId)).toEqual(['t3', 't2', 't1'])
    })

    it('свежий recordPlay поднимает трек наверх', async () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      await new Promise((r) => setTimeout(r, 5))
      store.recordPlay(makeTrack('t2'))

      expect(store.sortedHistory[0]!.trackId).toBe('t2')

      await new Promise((r) => setTimeout(r, 5))
      store.recordPlay(makeTrack('t1'))

      expect(store.sortedHistory[0]!.trackId).toBe('t1')
    })
  })

  describe('uniqueHistory', () => {
    it('дедуплицирует по trackId, оставляя свежую запись', async () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      await new Promise((r) => setTimeout(r, 5))
      store.recordPlay(makeTrack('t2'))
      await new Promise((r) => setTimeout(r, 5))
      store.recordPlay(makeTrack('t1', { title: 'Updated' }))

      const unique = store.uniqueHistory
      expect(unique.length).toBe(2)
      expect(unique[0]!.trackId).toBe('t1')
      expect(unique[0]!.title).toBe('Updated')
      expect(unique[1]!.trackId).toBe('t2')
    })

    it('порядок — по свежести', async () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      await new Promise((r) => setTimeout(r, 5))
      store.recordPlay(makeTrack('t2'))
      await new Promise((r) => setTimeout(r, 5))
      store.recordPlay(makeTrack('t3'))

      expect(store.uniqueHistory.map((e) => e.trackId)).toEqual(['t3', 't2', 't1'])
    })

    it('для одинаковых trackId остаётся один', () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      store.recordPlay(makeTrack('t1'))
      store.recordPlay(makeTrack('t1'))

      expect(store.uniqueHistory.length).toBe(1)
    })
  })

  describe('isEmpty', () => {
    it('true при пустой истории', () => {
      const store = useHistoryStore()
      expect(store.isEmpty).toBe(true)
    })

    it('false после recordPlay', () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      expect(store.isEmpty).toBe(false)
    })

    it('снова true после clear', () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      store.clear()
      expect(store.isEmpty).toBe(true)
    })
  })

  describe('getEntry', () => {
    it('возвращает запись по trackId', () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      const entry = store.getEntry('t1')
      expect(entry).not.toBe(null)
      expect(entry!.trackId).toBe('t1')
    })

    it('возвращает null для несуществующего', () => {
      const store = useHistoryStore()
      expect(store.getEntry('t:missing')).toBe(null)
    })

    it('возвращает актуальную запись после обновления', async () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1', { title: 'Old' }))
      await new Promise((r) => setTimeout(r, 5))
      store.recordPlay(makeTrack('t1', { title: 'New' }))

      expect(store.getEntry('t1')!.title).toBe('New')
    })
  })

  describe('clear', () => {
    it('обнуляет entries и вызывает persistence.clear', () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      store.recordPlay(makeTrack('t2'))

      store.clear()

      expect(store.entries).toEqual([])
      expect(mockPersistence.clear).toHaveBeenCalled()
    })

    it('идемпотентен', () => {
      const store = useHistoryStore()
      store.clear()
      store.clear()
      expect(store.entries).toEqual([])
      expect(mockPersistence.clear).toHaveBeenCalledTimes(2)
    })
  })

  describe('restore', () => {
    it('возвращает false при пустом IDB', async () => {
      const store = useHistoryStore()
      mockPersistence.load.mockResolvedValue(null)

      const result = await store.restore()

      expect(result).toBe(false)
      expect(store.entries).toEqual([])
    })

    it('возвращает false при пустом массиве в IDB', async () => {
      const store = useHistoryStore()
      mockPersistence.load.mockResolvedValue([])

      const result = await store.restore()

      expect(result).toBe(false)
    })

    it('восстанавливает entries из IDB', async () => {
      const store = useHistoryStore()
      mockPersistence.load.mockResolvedValue([
        {
          trackId: 't1',
          pluginId: 'local',
          title: 'Track 1',
          artist: 'Artist',
          album: 'Album',
          playedAt: 1000,
        },
        {
          trackId: 't2',
          pluginId: 'local',
          title: 'Track 2',
          artist: 'Artist',
          album: 'Album',
          playedAt: 2000,
        },
      ])

      const result = await store.restore()

      expect(result).toBe(true)
      expect(store.entries.length).toBe(2)
      expect(store.entries.map((e) => e.trackId)).toEqual(['t1', 't2'])
    })

    it('isRestoring сбрасывается после restore', async () => {
      const store = useHistoryStore()
      await store.restore()
      expect(store.isRestoring).toBe(false)
    })

    it('isRestoring = true во время restore', async () => {
      const store = useHistoryStore()
      let resolveLoad: (value: null) => void = () => {}
      mockPersistence.load.mockReturnValue(
        new Promise<null>((resolve) => {
          resolveLoad = resolve
        }),
      )

      const promise = store.restore()
      expect(store.isRestoring).toBe(true)

      resolveLoad(null)
      await promise
      expect(store.isRestoring).toBe(false)
    })
  })

  describe('save', () => {
    it('сохраняет plain-объекты', async () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))

      await store.save()

      expect(mockPersistence.save).toHaveBeenCalled()
      const arg = mockPersistence.save.mock.calls[0]![0]
      expect(Array.isArray(arg)).toBe(true)
      expect(arg[0]!.trackId).toBe('t1')
    })

    it('автосохранение вызывается при recordPlay', async () => {
      const store = useHistoryStore()
      vi.clearAllMocks()

      store.recordPlay(makeTrack('t1'))
      await flushWatch()

      expect(mockPersistence.save).toHaveBeenCalled()
    })

    it('автосохранение вызывается при clear', async () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      await flushWatch()
      vi.clearAllMocks()

      store.clear()
      await flushWatch()

      expect(mockPersistence.save).toHaveBeenCalled()
    })
  })

  describe('последовательные recordPlay', () => {
    it('порядок entries соответствует порядку добавления', () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      store.recordPlay(makeTrack('t2'))
      store.recordPlay(makeTrack('t3'))

      expect(store.entries.map((e) => e.trackId)).toEqual(['t1', 't2', 't3'])
    })

    it('повторный recordPlay не меняет позицию в entries', () => {
      const store = useHistoryStore()
      store.recordPlay(makeTrack('t1'))
      store.recordPlay(makeTrack('t2'))
      store.recordPlay(makeTrack('t1'))

      expect(store.entries.map((e) => e.trackId)).toEqual(['t1', 't2'])
    })
  })
})
