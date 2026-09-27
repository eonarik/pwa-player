// oxlint-disable vitest/require-mock-type-parameters
// src/stores/player.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePlayerStore } from './player'

// vi.hoisted выполняется до всех импортов и vi.mock — сюда кладём моки
const { mockAudioService, mockPersistenceService, mockRestoreTracks, mockMetadataService } =
  vi.hoisted(() => {
    // Хранилище подписок: event → Set<handler>
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>()

    const mockAudioService = {
      load: vi.fn(),
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      seek: vi.fn(),
      unload: vi.fn(),
      setVolume: vi.fn(),
      setMuted: vi.fn(),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!listeners.has(event)) listeners.set(event, new Set())
        listeners.get(event)!.add(handler)
        return () => {
          listeners.get(event)?.delete(handler)
        }
      }),
      /** Тестовый хелпер: эмулировать событие */
      __emit(event: string, payload?: unknown) {
        listeners.get(event)?.forEach((h) => h(payload))
      },
      /** Тестовый хелпер: очистить все подписки */
      __resetListeners() {
        listeners.clear()
      },
      // Поля-состояния
      currentTime: 0,
      duration: 0,
      paused: true,
      volume: 1,
      muted: false,
    }

    return {
      mockAudioService,
      mockPersistenceService: {
        scheduleSave: vi.fn(),
        saveNow: vi.fn(() => Promise.resolve()),
        load: vi.fn<() => Promise<unknown>>(() => Promise.resolve(null)),
        clear: vi.fn(() => Promise.resolve()),
        toPersisted: vi.fn((t: unknown) => t),
      },
      mockRestoreTracks: vi.fn<() => Promise<unknown>>(() => Promise.resolve([])),
      mockMetadataService: {
        revokeCover: vi.fn(),
      },
    }
  })

vi.mock('@/services/audio/AudioService', () => ({
  audioService: mockAudioService,
}))

vi.mock('@/services/metadata/MetadataService', () => ({
  metadataService: mockMetadataService,
}))

vi.mock('@/services/filesystem/FileSystemService', () => ({
  fileSystemService: {
    findCoverInDirectory: vi.fn(() => Promise.resolve(null)),
  },
}))

vi.mock('@/services/persistence/PersistenceService', () => ({
  persistenceService: mockPersistenceService,
}))

vi.mock('@/services/persistence/restore', () => ({
  restoreTracks: mockRestoreTracks,
}))

// --- Вспомогательные фабрики ------------------------------------------

interface TestTrack {
  id: string
  source: string
  filename: string
  title: string
  artist: string
  album: string
}

function makeTrack(id: string, title = `Track ${id}`): TestTrack {
  return {
    id,
    source: `https://example.com/${id}.mp3`,
    filename: `${id}.mp3`,
    title,
    artist: 'Artist',
    album: 'Album',
  }
}

describe('usePlayerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())

    // Сбрасываем все моки и состояние
    vi.clearAllMocks()
    mockAudioService.__resetListeners()
    mockAudioService.currentTime = 0
    mockAudioService.duration = 0
    mockAudioService.paused = true
    mockAudioService.volume = 1
    mockAudioService.muted = false
    mockAudioService.play.mockResolvedValue(undefined)
    mockPersistenceService.load.mockResolvedValue(null)
    mockRestoreTracks.mockResolvedValue([])
  })

  // --- setQueue -------------------------------------------------------

  describe('setQueue', () => {
    it('устанавливает очередь и играет первый трек', () => {
      const store = usePlayerStore()
      const tracks = [makeTrack('a'), makeTrack('b'), makeTrack('c')]

      store.setQueue(tracks as never)

      expect(store.queue).toEqual(tracks)
      expect(store.currentIndex).toBe(0)
      expect(store.currentTrack?.id).toBe('a')
      expect(mockAudioService.load).toHaveBeenCalledWith(tracks[0]!.source)
      expect(mockAudioService.play).toHaveBeenCalled()
    })

    it('начинает с указанного индекса', () => {
      const store = usePlayerStore()
      const tracks = [makeTrack('a'), makeTrack('b'), makeTrack('c')]

      store.setQueue(tracks as never, 1)

      expect(store.currentIndex).toBe(1)
      expect(store.currentTrack?.id).toBe('b')
    })

    it('сбрасывает состояние при пустой очереди', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a')] as never)

      store.setQueue([])

      expect(store.queue).toEqual([])
      expect(store.currentIndex).toBe(-1)
      expect(store.currentTrack).toBe(null)
    })

    it('клампит startIndex, если он больше длины', () => {
      const store = usePlayerStore()
      const tracks = [makeTrack('a'), makeTrack('b')]

      store.setQueue(tracks as never, 999)

      expect(store.currentIndex).toBe(1)
    })

    it('клампит отрицательный startIndex в 0', () => {
      const store = usePlayerStore()
      const tracks = [makeTrack('a'), makeTrack('b')]

      store.setQueue(tracks as never, -5)

      expect(store.currentIndex).toBe(0)
    })
  })

  // --- next -----------------------------------------------------------

  describe('next', () => {
    it('переключает на следующий трек', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b'), makeTrack('c')] as never)
      vi.clearAllMocks()

      store.next()

      expect(store.currentIndex).toBe(1)
      expect(store.currentTrack?.id).toBe('b')
    })

    it('останавливается в конце очереди при repeat off', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      store.next()
      vi.clearAllMocks()

      store.next()

      expect(store.currentIndex).toBe(1)
      expect(store.isPlaying).toBe(false)
      expect(mockAudioService.play).not.toHaveBeenCalled()
    })

    it('возвращается в начало при repeat all', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      store.cycleRepeat() // off → all
      store.next()
      vi.clearAllMocks()

      store.next()

      expect(store.currentIndex).toBe(0)
      expect(store.currentTrack?.id).toBe('a')
    })

    it('ничего не делает при пустой очереди', () => {
      const store = usePlayerStore()
      store.next()
      expect(mockAudioService.play).not.toHaveBeenCalled()
    })

    it('при shuffle выбирает случайный индекс, отличный от текущего', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b'), makeTrack('c')] as never)
      store.toggleShuffle()

      // Math.random() = 0 → idx = 0. Текущий = 0. Значит цикл повторится.
      // Math.random() = 0.5 → idx = 1. Это не текущий — выходим.
      const randomSpy = vi.spyOn(Math, 'random')
      randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(0.5)

      store.next()

      expect(store.currentIndex).toBe(1)
      randomSpy.mockRestore()
    })
  })

  // --- prev -----------------------------------------------------------

  describe('prev', () => {
    it('перематывает в начало, если прошло больше 3 секунд', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      store.next()

      mockAudioService.currentTime = 10
      vi.clearAllMocks()

      store.prev()

      expect(mockAudioService.seek).toHaveBeenCalledWith(0)
      expect(store.currentIndex).toBe(1)
    })

    it('переключает на предыдущий трек, если прошло меньше 3 секунд', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      store.next()

      mockAudioService.currentTime = 1
      vi.clearAllMocks()

      store.prev()

      expect(store.currentIndex).toBe(0)
      expect(store.currentTrack?.id).toBe('a')
    })

    it('на первом треке с repeat off делает seek(0)', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      mockAudioService.currentTime = 1
      vi.clearAllMocks()

      store.prev()

      expect(mockAudioService.seek).toHaveBeenCalledWith(0)
      expect(store.currentIndex).toBe(0)
    })

    it('на первом треке с repeat all переходит на последний', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b'), makeTrack('c')] as never)
      store.cycleRepeat() // off → all
      mockAudioService.currentTime = 1
      vi.clearAllMocks()

      store.prev()

      expect(store.currentIndex).toBe(2)
      expect(store.currentTrack?.id).toBe('c')
    })

    it('ничего не делает при пустой очереди', () => {
      const store = usePlayerStore()
      store.prev()
      expect(mockAudioService.play).not.toHaveBeenCalled()
    })
  })

  // --- removeFromQueue ------------------------------------------------

  describe('removeFromQueue', () => {
    it('удаляет текущий трек (не последний) и играет следующий', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b'), makeTrack('c')] as never)
      store.next() // currentIndex = 1 (b)
      vi.clearAllMocks()

      store.removeFromQueue(1)

      expect(store.queue.map((t) => t.id)).toEqual(['a', 'c'])
      expect(store.currentIndex).toBe(1)
      expect(store.currentTrack?.id).toBe('c')
      expect(mockAudioService.load).toHaveBeenCalledWith('https://example.com/c.mp3')
    })

    it('удаляет текущий последний трек и играет нового последнего', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b'), makeTrack('c')] as never)
      store.next()
      store.next() // currentIndex = 2 (c)
      vi.clearAllMocks()

      store.removeFromQueue(2)

      expect(store.queue.map((t) => t.id)).toEqual(['a', 'b'])
      expect(store.currentIndex).toBe(1)
      expect(store.currentTrack?.id).toBe('b')
    })

    it('удаляет трек до текущего и сдвигает currentIndex без перезапуска', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b'), makeTrack('c')] as never)
      store.next()
      store.next() // currentIndex = 2 (c)
      vi.clearAllMocks()

      store.removeFromQueue(0)

      expect(store.queue.map((t) => t.id)).toEqual(['b', 'c'])
      expect(store.currentIndex).toBe(1)
      expect(store.currentTrack?.id).toBe('c')
      // Воспроизведение не перезапускается
      expect(mockAudioService.load).not.toHaveBeenCalled()
      expect(mockAudioService.play).not.toHaveBeenCalled()
    })

    it('удаляет трек после текущего и не меняет currentIndex', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b'), makeTrack('c')] as never)
      store.next() // currentIndex = 1 (b)
      vi.clearAllMocks()

      store.removeFromQueue(2)

      expect(store.queue.map((t) => t.id)).toEqual(['a', 'b'])
      expect(store.currentIndex).toBe(1)
      expect(store.currentTrack?.id).toBe('b')
      expect(mockAudioService.load).not.toHaveBeenCalled()
    })

    it('удаляет единственный трек и очищает очередь через stop()', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a')] as never)
      vi.clearAllMocks()

      store.removeFromQueue(0)

      expect(store.queue).toEqual([])
      expect(store.currentIndex).toBe(-1)
      expect(store.currentTrack).toBe(null)
      expect(mockAudioService.unload).toHaveBeenCalled()
    })

    it('игнорирует невалидный индекс', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      vi.clearAllMocks()

      store.removeFromQueue(-1)
      store.removeFromQueue(999)

      expect(store.queue.length).toBe(2)
      expect(mockAudioService.load).not.toHaveBeenCalled()
    })
  })

  // --- clearQueue -----------------------------------------------------

  describe('clearQueue', () => {
    it('полностью очищает очередь и вызывает audioService.unload', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      vi.clearAllMocks()

      store.clearQueue()

      expect(store.queue).toEqual([])
      expect(store.currentIndex).toBe(-1)
      expect(store.currentTrack).toBe(null)
      expect(mockAudioService.unload).toHaveBeenCalled()
    })
  })

  // --- stop -----------------------------------------------------------

  describe('stop', () => {
    it('сбрасывает всё состояние и вызывает audioService.unload/pause/seek', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a')] as never)
      vi.clearAllMocks()

      store.stop()

      expect(store.queue).toEqual([])
      expect(store.currentIndex).toBe(-1)
      expect(store.currentTrack).toBe(null)
      expect(store.isPlaying).toBe(false)
      expect(store.currentTime).toBe(0)
      expect(store.duration).toBe(0)
      expect(mockAudioService.unload).toHaveBeenCalled()
      expect(mockAudioService.pause).toHaveBeenCalled()
      expect(mockAudioService.seek).toHaveBeenCalledWith(0)
    })
  })

  // --- hasNext / hasPrev ---------------------------------------------

  describe('hasNext / hasPrev', () => {
    it('hasNext: true, если есть следующий трек', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      expect(store.hasNext).toBe(true)
    })

    it('hasNext: false на последнем треке с repeat off', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      store.next()
      expect(store.hasNext).toBe(false)
    })

    it('hasNext: true на последнем с repeat all', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      store.next()
      store.cycleRepeat() // → all
      expect(store.hasNext).toBe(true)
    })

    it('hasNext: true при shuffle, если треков больше 1', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      store.next()
      store.toggleShuffle()
      expect(store.hasNext).toBe(true)
    })

    it('hasNext: false при shuffle с одним треком', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a')] as never)
      store.toggleShuffle()
      expect(store.hasNext).toBe(false)
    })

    it('hasPrev: false на первом треке с repeat off', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      expect(store.hasPrev).toBe(false)
    })

    it('hasPrev: true на втором треке', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      store.next()
      expect(store.hasPrev).toBe(true)
    })

    it('hasPrev: true на первом с repeat all', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      store.cycleRepeat() // → all
      expect(store.hasPrev).toBe(true)
    })
  })

  // --- cycleRepeat / toggleShuffle ------------------------------------

  describe('cycleRepeat', () => {
    it('циклится off → all → one → off', () => {
      const store = usePlayerStore()

      expect(store.repeatMode).toBe('off')
      store.cycleRepeat()
      expect(store.repeatMode).toBe('all')
      store.cycleRepeat()
      expect(store.repeatMode).toBe('one')
      store.cycleRepeat()
      expect(store.repeatMode).toBe('off')
    })
  })

  describe('toggleShuffle', () => {
    it('переключает shuffle', () => {
      const store = usePlayerStore()
      expect(store.shuffle).toBe(false)
      store.toggleShuffle()
      expect(store.shuffle).toBe(true)
      store.toggleShuffle()
      expect(store.shuffle).toBe(false)
    })
  })

  // --- volume / seek --------------------------------------------------

  describe('setVolume', () => {
    it('вызывает audioService.setVolume', () => {
      const store = usePlayerStore()
      store.setVolume(0.5)
      expect(mockAudioService.setVolume).toHaveBeenCalledWith(0.5)
    })
  })

  describe('setVolumeBy', () => {
    it('увеличивает громкость относительно текущей', () => {
      const store = usePlayerStore()
      mockAudioService.volume = 0.5
      store.setVolumeBy(0.1)
      expect(mockAudioService.setVolume).toHaveBeenCalledWith(expect.closeTo(0.6, 5))
    })
  })

  describe('seek', () => {
    it('вызывает audioService.seek', () => {
      const store = usePlayerStore()
      store.seek(42)
      expect(mockAudioService.seek).toHaveBeenCalledWith(42)
    })

    it('обновляет currentTime из audioService', () => {
      const store = usePlayerStore()
      mockAudioService.currentTime = 42.7
      store.seek(42)
      expect(store.currentTime).toBe(42.7)
    })
  })

  describe('toggleMute', () => {
    it('переключает mute', () => {
      const store = usePlayerStore()
      mockAudioService.muted = false
      store.toggleMute()
      expect(mockAudioService.setMuted).toHaveBeenCalledWith(true)
    })

    it('снимает mute, если был включён', () => {
      const store = usePlayerStore()
      mockAudioService.muted = true
      store.toggleMute()
      expect(mockAudioService.setMuted).toHaveBeenCalledWith(false)
    })
  })

  // --- handleTrackEnd через событие ended -----------------------------

  describe('handleTrackEnd (через audioService.on("ended"))', () => {
    it('при repeat one перезапускает текущий трек', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      store.cycleRepeat()
      store.cycleRepeat() // → one
      vi.clearAllMocks()

      mockAudioService.__emit('ended')

      expect(mockAudioService.seek).toHaveBeenCalledWith(0)
      expect(mockAudioService.play).toHaveBeenCalled()
      expect(store.currentIndex).toBe(0)
    })

    it('при repeat off на последнем треке останавливает воспроизведение', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      store.next() // currentIndex = 1
      vi.clearAllMocks()

      mockAudioService.__emit('ended')

      expect(store.isPlaying).toBe(false)
      expect(mockAudioService.play).not.toHaveBeenCalled()
    })

    it('при repeat off на не-последнем переходит к следующему', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b'), makeTrack('c')] as never)
      vi.clearAllMocks()

      mockAudioService.__emit('ended')

      expect(store.currentIndex).toBe(1)
      expect(store.currentTrack?.id).toBe('b')
    })

    it('при repeat all на последнем треке возвращается к первому', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      store.next() // currentIndex = 1
      store.cycleRepeat() // → all
      vi.clearAllMocks()

      mockAudioService.__emit('ended')

      expect(store.currentIndex).toBe(0)
      expect(store.currentTrack?.id).toBe('a')
    })
  })

  // --- play при пустом currentTrack -----------------------------------

  describe('play', () => {
    it('запускает первый трек, если currentTrack = null, а очередь не пуста', () => {
      const store = usePlayerStore()
      store.queue = [makeTrack('a')] as never
      vi.clearAllMocks()

      store.play()

      expect(store.currentIndex).toBe(0)
      expect(mockAudioService.play).toHaveBeenCalled()
    })

    it('вызывает audioService.play, если трек уже выбран', () => {
      const store = usePlayerStore()
      store.setQueue([makeTrack('a')] as never)
      vi.clearAllMocks()

      store.play()

      expect(mockAudioService.play).toHaveBeenCalled()
    })
  })

  // --- progress -------------------------------------------------------

  describe('progress', () => {
    it('0, если duration = 0', () => {
      const store = usePlayerStore()
      expect(store.progress).toBe(0)
    })

    it('отношение currentTime / duration', () => {
      const store = usePlayerStore()
      store.duration = 100
      store.currentTime = 25
      expect(store.progress).toBe(0.25)
    })
  })

  // --- restore --------------------------------------------------------

  describe('restore', () => {
    it('возвращает false при пустом state', async () => {
      const store = usePlayerStore()
      mockPersistenceService.load.mockResolvedValue(null)

      const result = await store.restore()

      expect(result).toBe(false)
    })

    it('возвращает false, если state.tracks пуст', async () => {
      const store = usePlayerStore()
      mockPersistenceService.load.mockResolvedValue({
        tracks: [],
        currentIndex: 0,
        currentTime: 0,
        volume: 1,
        muted: false,
        repeatMode: 'off',
        shuffle: false,
        savedAt: Date.now(),
      })

      const result = await store.restore()

      expect(result).toBe(false)
    })

    it('восстанавливает состояние и загружает трек', async () => {
      const store = usePlayerStore()
      const persistedTrack = {
        id: 'a',
        title: 'Track A',
        artist: 'Artist',
        album: 'Album',
        filename: 'a.mp3',
        source: 'file://a.mp3',
      }
      mockPersistenceService.load.mockResolvedValue({
        tracks: [persistedTrack],
        currentIndex: 0,
        currentTime: 30,
        volume: 0.5,
        muted: true,
        repeatMode: 'all',
        shuffle: true,
        savedAt: Date.now(),
      })
      mockRestoreTracks.mockResolvedValue([{ ...persistedTrack, source: 'file://a.mp3' }])

      const result = await store.restore()

      expect(result).toBe(true)
      expect(store.queue.length).toBe(1)
      expect(store.currentIndex).toBe(0)
      expect(store.volume).toBe(0.5)
      expect(store.muted).toBe(true)
      expect(store.repeatMode).toBe('all')
      expect(store.shuffle).toBe(true)
      expect(mockAudioService.load).toHaveBeenCalledWith('file://a.mp3')
      expect(mockAudioService.setVolume).toHaveBeenCalledWith(0.5)
      expect(mockAudioService.setMuted).toHaveBeenCalledWith(true)
    })

    it('seek применяется после loadedmetadata', async () => {
      const store = usePlayerStore()
      const persistedTrack = {
        id: 'a',
        title: 'Track A',
        artist: 'Artist',
        album: 'Album',
        filename: 'a.mp3',
        source: 'file://a.mp3',
      }
      mockPersistenceService.load.mockResolvedValue({
        tracks: [persistedTrack],
        currentIndex: 0,
        currentTime: 30,
        volume: 1,
        muted: false,
        repeatMode: 'off',
        shuffle: false,
        savedAt: Date.now(),
      })
      mockRestoreTracks.mockResolvedValue([{ ...persistedTrack, source: 'file://a.mp3' }])

      await store.restore()
      vi.clearAllMocks()

      mockAudioService.__emit('loadedmetadata', { duration: 100 })

      expect(mockAudioService.seek).toHaveBeenCalledWith(30)
    })
  })

  // --- $dispose -------------------------------------------------------

  describe('$dispose', () => {
    it('снимает все подписки на audioService', () => {
      const store = usePlayerStore()
      store.$dispose()

      // После dispose событие ended не должно вызывать handleTrackEnd
      store.setQueue([makeTrack('a'), makeTrack('b')] as never)
      vi.clearAllMocks()
      store.next()
      const indexAfterNext = store.currentIndex

      mockAudioService.__emit('ended')

      // currentIndex не изменился от ended, потому что подписка снята
      expect(store.currentIndex).toBe(indexAfterNext)
    })
  })
})
