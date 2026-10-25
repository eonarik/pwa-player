// src/stores/player/actions.integration.spec.ts
// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, shallowRef, type Ref } from 'vue'
import { AuthError, ServerError, NetworkError } from '@/services/api/errors'
import type { Track } from '@/types/track'
import type { AudioEventMap, AudioEventName, AudioListener } from '@/services/audio/types'
import { apiClient } from '@/services/api/ApiClient'
import { connectPlugin } from '@/services/plugins/connectPlugin'
import { resolveTrackSource } from '@/services/audio/resolveTrackSource'
import { toastService } from '@/services/ui/ToastService'
import { createPlayerActions, type PlayerActionsRefs } from './actions'
import { bindAudioEvents, type AudioEventsCallbacks } from './events'

// --- Хойстнутые моки ----------------------------------------------------
const mocks = vi.hoisted(() => {
  type ListenersMap = Map<AudioEventName, Set<AudioListener<AudioEventName>>>
  const listeners: ListenersMap = new Map()

  const audioMock = {
    load: vi.fn(),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    seek: vi.fn(),
    unload: vi.fn(),
    setVolume: vi.fn(),
    setMuted: vi.fn(),

    paused: false,
    currentTime: 0,
    volume: 1,
    muted: false,

    on<K extends AudioEventName>(event: K, listener: AudioListener<K>): () => void {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(listener as AudioListener<AudioEventName>)
      return () => listeners.get(event)?.delete(listener as AudioListener<AudioEventName>)
    },

    emit<K extends AudioEventName>(event: K, payload: AudioEventMap[K]): void {
      listeners.get(event)?.forEach((fn) => fn(payload))
    },

    reset(): void {
      listeners.clear()
      audioMock.load.mockReset()
      audioMock.play.mockReset()
      audioMock.pause.mockReset()
      audioMock.seek.mockReset()
      audioMock.unload.mockReset()
      audioMock.setVolume.mockReset()
      audioMock.setMuted.mockReset()
      audioMock.paused = false
      audioMock.currentTime = 0
    },
  }

  const isDislikedMock = vi.fn().mockReturnValue(false)

  return { audioMock, isDislikedMock }
})

const { audioMock, isDislikedMock } = mocks

// --- Моки модулей -------------------------------------------------------

vi.mock('@/services/audio/AudioService', () => ({
  audioService: mocks.audioMock,
}))

vi.mock('@/services/audio/resolveTrackSource', () => ({
  resolveTrackSource: vi.fn(),
}))

vi.mock('@/services/plugins/connectPlugin', () => ({
  connectPlugin: vi.fn(),
}))

vi.mock('@/services/ui/ToastService', () => ({
  toastService: {
    showPersistent: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('@/stores/dislikes', () => ({
  useDislikesStore: () => ({
    isDisliked: mocks.isDislikedMock,
  }),
}))

vi.mock('@/plugins/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/plugins/registry')>()
  return {
    ...actual,
    pluginIdFromSource: (source: string) => {
      const colon = source.indexOf(':')
      return colon === -1 ? source : source.slice(0, colon)
    },
    isLiveStream: () => false,
  }
})

// --- Хелперы ------------------------------------------------------------

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track:yandex-self:disk:/Music/01.mp3',
    pluginId: 'yandex-self',
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    filename: '01.mp3',
    source: 'https://example.com/song.mp3',
    ...overrides,
  } as Track
}

function makeRefs(
  tracks: Track[] = [],
): PlayerActionsRefs & { volume: Ref<number>; muted: Ref<boolean> } {
  return {
    queue: ref(tracks),
    currentIndex: ref(-1),
    currentTrack: shallowRef<Track | null>(null),
    isPlaying: ref(false),
    duration: ref(0),
    currentTime: ref(0),
    repeatMode: ref<'off' | 'one' | 'all'>('off'),
    shuffle: ref(false),
    volume: ref(1),
    muted: ref(false),
  }
}

function makeActionsCallbacks() {
  return {
    syncCurrentTime: vi.fn(),
    stopTimeLoop: vi.fn(),
  }
}

function makeEventsCallbacks(): AudioEventsCallbacks {
  return {
    startTimeLoop: vi.fn(),
    stopTimeLoop: vi.fn(),
    flushPlayback: vi.fn(async () => {}),
    handleTrackEnd: vi.fn(),
    updateTrackDuration: vi.fn(),
    retryPlayback: vi.fn(),
    handleAuthError: vi.fn(),
  }
}

// --- Тесты --------------------------------------------------------------

describe('player actions — интеграция с events', () => {
  let healthCheckSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    audioMock.reset()
    isDislikedMock.mockReset()
    isDislikedMock.mockReturnValue(false)

    healthCheckSpy = vi.spyOn(apiClient, 'healthCheck').mockReset()
    vi.mocked(resolveTrackSource).mockReset()
    vi.mocked(connectPlugin).mockReset()
    vi.mocked(toastService.showPersistent).mockReset()
    vi.mocked(toastService.error).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('playAll', () => {
    it('все треки доступны → стартует с первого', async () => {
      const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })]
      const refs = makeRefs(tracks)
      const actions = createPlayerActions(refs, makeActionsCallbacks())

      vi.mocked(resolveTrackSource).mockResolvedValue('https://example.com/1.mp3')

      actions.playAll(tracks)
      await vi.waitFor(() => {
        expect(audioMock.load).toHaveBeenCalledOnce()
      })

      expect(refs.currentIndex.value).toBe(0)
      expect(refs.currentTrack.value?.id).toBe('t1')
      expect(audioMock.load).toHaveBeenCalledWith('https://example.com/1.mp3')
      expect(audioMock.play).toHaveBeenCalledOnce()
    })

    it('первый недоступен → стартует со второго', async () => {
      const unavailable = makeTrack({ id: 't1', source: '', handle: undefined })
      const available = makeTrack({ id: 't2' })
      const tracks = [unavailable, available]

      const refs = makeRefs(tracks)
      const actions = createPlayerActions(refs, makeActionsCallbacks())

      vi.mocked(resolveTrackSource).mockResolvedValue('https://example.com/2.mp3')

      actions.playAll(tracks)
      await vi.waitFor(() => {
        expect(audioMock.load).toHaveBeenCalledOnce()
      })

      expect(refs.currentIndex.value).toBe(1)
      expect(refs.currentTrack.value?.id).toBe('t2')
    })

    it('все недоступны → тост, очередь не запускается', async () => {
      const tracks = [
        makeTrack({ id: 't1', source: '', handle: undefined }),
        makeTrack({ id: 't2', source: '', handle: undefined }),
      ]
      const refs = makeRefs(tracks)
      const actions = createPlayerActions(refs, makeActionsCallbacks())

      actions.playAll(tracks)

      await vi.waitFor(() => {
        expect(toastService.error).toHaveBeenCalled()
      })

      expect(toastService.error).toHaveBeenCalledWith(
        'Все треки недоступны. Подключите плагин или скачайте треки.',
      )
      expect(audioMock.load).not.toHaveBeenCalled()
      expect(audioMock.play).not.toHaveBeenCalled()
    })
  })

  describe('playAt — AuthError от resolveTrackSource', () => {
    it('показывает тост с кнопкой и повторяет playAt после connect', async () => {
      const track = makeTrack({ id: 't1' })
      const refs = makeRefs([track])
      const actions = createPlayerActions(refs, makeActionsCallbacks())

      vi.mocked(resolveTrackSource).mockRejectedValueOnce(
        new AuthError({ providerId: 'yandex-self', reason: 'refresh-expired' }),
      )

      await actions.playAt(0)

      expect(toastService.showPersistent).toHaveBeenCalledOnce()
      const [, , action] = vi.mocked(toastService.showPersistent).mock.calls[0] as [
        string,
        string,
        { label: string; onAction: () => void },
      ]
      expect(action.label).toBe('Подключить')

      vi.mocked(connectPlugin).mockResolvedValueOnce(true)
      vi.mocked(resolveTrackSource).mockResolvedValueOnce('https://example.com/1.mp3')

      action.onAction()
      await vi.waitFor(() => {
        expect(audioMock.load).toHaveBeenCalledOnce()
      })

      expect(connectPlugin).toHaveBeenCalledWith('yandex-self')
      expect(audioMock.load).toHaveBeenCalledWith('https://example.com/1.mp3')
    })
  })

  describe('events.handleStreamError', () => {
    function setup() {
      const track = makeTrack({ id: 't1' })
      const refs = makeRefs([track])
      refs.currentIndex.value = 0
      refs.currentTrack.value = track

      const callbacks = makeEventsCallbacks()
      const events = bindAudioEvents(refs, callbacks)

      return { track, refs, callbacks, events }
    }

    it('healthCheck успешен → retryPlayback', async () => {
      healthCheckSpy.mockResolvedValueOnce(undefined)
      const { callbacks } = setup()

      audioMock.emit('error', { message: 'boom', src: 'https://x' })
      await vi.waitFor(() => {
        expect(healthCheckSpy).toHaveBeenCalledWith('yandex-self')
      })
      await vi.waitFor(() => {
        expect(callbacks.retryPlayback).toHaveBeenCalledOnce()
      })
    })

    it('healthCheck → AuthError → callbacks.handleAuthError', async () => {
      const err = new AuthError({ providerId: 'yandex-self', reason: 'refresh-expired' })
      healthCheckSpy.mockRejectedValueOnce(err)
      const { callbacks, track } = setup()

      audioMock.emit('error', { message: 'boom', src: 'https://x' })
      await vi.waitFor(() => {
        expect(callbacks.handleAuthError).toHaveBeenCalledOnce()
      })

      expect(callbacks.handleAuthError).toHaveBeenCalledWith(err, track)
      expect(callbacks.retryPlayback).not.toHaveBeenCalled()
    })

    it('healthCheck → ServerError → pause + тост + retry через 10с', async () => {
      vi.useFakeTimers()
      healthCheckSpy.mockRejectedValueOnce(new ServerError(500))
      const { callbacks } = setup()

      audioMock.emit('error', { message: 'boom', src: 'https://x' })
      await vi.waitFor(() => {
        expect(audioMock.pause).toHaveBeenCalled()
      })

      expect(toastService.error).toHaveBeenCalledWith('Ошибка сервера. Повторим позже.')
      expect(callbacks.retryPlayback).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(10_000)
      expect(callbacks.retryPlayback).toHaveBeenCalledOnce()
    })

    it('healthCheck → NetworkError → pause + тост + retry через 10с', async () => {
      vi.useFakeTimers()
      healthCheckSpy.mockRejectedValueOnce(new NetworkError(new Error('network')))
      const { callbacks } = setup()

      audioMock.emit('error', { message: 'boom', src: 'https://x' })
      await vi.waitFor(() => {
        expect(audioMock.pause).toHaveBeenCalled()
      })

      expect(toastService.error).toHaveBeenCalledWith('Проблема с сетью. Повторим позже.')
      expect(callbacks.retryPlayback).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(10_000)
      expect(callbacks.retryPlayback).toHaveBeenCalledOnce()
    })

    it('retry-таймер отменяется при смене currentTrack', async () => {
      vi.useFakeTimers()
      healthCheckSpy.mockRejectedValueOnce(new ServerError(500))
      const { callbacks, refs } = setup()

      audioMock.emit('error', { message: 'boom', src: 'https://x' })
      await vi.waitFor(() => {
        expect(toastService.error).toHaveBeenCalled()
      })

      refs.currentTrack.value = makeTrack({ id: 't2' })

      await vi.advanceTimersByTimeAsync(10_000)
      expect(callbacks.retryPlayback).not.toHaveBeenCalled()
    })
  })
})
