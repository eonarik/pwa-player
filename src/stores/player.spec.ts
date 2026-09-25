// src/stores/player.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePlayerStore } from './player'

// vi.hoisted выполняется до всех импортов и vi.mock — сюда кладём моки
const { mockAudioService, mockPersistenceService, mockRestoreTracks } = vi.hoisted(() => ({
  mockAudioService: {
    load: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    on: vi.fn(() => () => {}), // возвращает unsubscribe-функцию
    // Поля-состояния (в оригинале геттеры, но для тестов сторов достаточно полей)
    currentTime: 0,
    duration: 0,
    paused: true,
    volume: 1,
    muted: false,
  },
  mockPersistenceService: {
    scheduleSave: vi.fn(),
    saveNow: vi.fn(() => Promise.resolve()),
    load: vi.fn(() => Promise.resolve(null)),
    clear: vi.fn(() => Promise.resolve()),
    toPersisted: vi.fn((t: unknown) => t),
  },
  mockRestoreTracks: vi.fn(() => Promise.resolve([])),
}))

vi.mock('@/services/audio/AudioService', () => ({
  audioService: mockAudioService,
}))

vi.mock('@/services/metadata/MetadataService', () => ({
  metadataService: {
    revokeCover: vi.fn(),
  },
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
    mockAudioService.currentTime = 0
    mockAudioService.duration = 0
    mockAudioService.paused = true
    mockAudioService.volume = 1
    mockAudioService.muted = false
    mockAudioService.play.mockResolvedValue(undefined)
    mockPersistenceService.load.mockResolvedValue(null)
    mockRestoreTracks.mockResolvedValue([])
  })

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
  })

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
  })

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
  })

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

  describe('setVolume', () => {
    it('вызывает audioService.setVolume', () => {
      const store = usePlayerStore()
      store.setVolume(0.5)
      expect(mockAudioService.setVolume).toHaveBeenCalledWith(0.5)
    })
  })

  describe('seek', () => {
    it('вызывает audioService.seek', () => {
      const store = usePlayerStore()
      store.seek(42)
      expect(mockAudioService.seek).toHaveBeenCalledWith(42)
    })
  })

  describe('toggleMute', () => {
    it('переключает mute', () => {
      const store = usePlayerStore()
      mockAudioService.muted = false
      store.toggleMute()
      expect(mockAudioService.setMuted).toHaveBeenCalledWith(true)
    })
  })
})
