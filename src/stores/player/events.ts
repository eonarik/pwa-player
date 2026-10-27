// src/stores/player/events.ts

import type { Ref, ShallowRef } from 'vue'
import { audioService } from '@/services/audio/AudioService'
import { useHistoryStore } from '../history'
import { isLiveStream, pluginIdFromSource } from '@/plugins/registry'
import { apiClient } from '@/services/api/ApiClient'
import { AuthError, ServerError, NetworkError } from '@/services/api/errors'
import { toastService } from '@/services/ui/ToastService'
import type { Track } from '@/types/track'

export interface AudioEventsRefs {
  queue: Ref<Track[]>
  currentIndex: Ref<number>
  currentTrack: ShallowRef<Track | null>
  isPlaying: Ref<boolean>
  duration: Ref<number>
  volume: Ref<number>
  muted: Ref<boolean>
}

export interface AudioEventsCallbacks {
  startTimeLoop: () => void
  stopTimeLoop: () => void
  flushPlayback: () => Promise<void>
  handleTrackEnd: () => void
  updateTrackDuration: (trackId: string, duration: number) => void
  retryPlayback: () => void
  handleAuthError: (error: AuthError, track: Track) => void
}

export interface AudioEvents {
  unsubscribeAll: () => void
}

const RETRY_DELAY_MS = 10_000
const MAX_RETRIES = 3

export function bindAudioEvents(
  refs: AudioEventsRefs,
  callbacks: AudioEventsCallbacks,
): AudioEvents {
  const { queue, currentIndex, currentTrack, isPlaying, duration, volume, muted } = refs

  const unsubscribers: Array<() => void> = []

  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryTrackId: string | null = null

  /** Счётчик ретраев на трек. Сбрасывается при успешном `play`. */
  const retryCounts = new Map<string, number>()

  function cancelRetry(): void {
    if (retryTimer !== null) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    retryTrackId = null
  }

  function bumpRetryCount(trackId: string): number {
    const next = (retryCounts.get(trackId) ?? 0) + 1
    retryCounts.set(trackId, next)
    return next
  }

  function resetRetryCount(trackId: string): void {
    retryCounts.delete(trackId)
  }

  function scheduleRetry(track: Track): void {
    cancelRetry()

    const attempt = bumpRetryCount(track.id)
    if (attempt > MAX_RETRIES) {
      toastService.error(`Не удалось воспроизвести «${track.title}» — попытки исчерпаны`)
      return
    }

    retryTrackId = track.id
    retryTimer = setTimeout(() => {
      retryTimer = null
      if (currentTrack.value?.id !== retryTrackId) {
        retryTrackId = null
        return
      }
      retryTrackId = null
      callbacks.retryPlayback()
    }, RETRY_DELAY_MS)
  }

  async function handleStreamError(
    track: Track,
    _error: { src: string; message: string },
  ): Promise<void> {
    const pluginId = pluginIdFromSource(track.pluginId)

    try {
      await apiClient.healthCheck(pluginId)
      callbacks.retryPlayback()
    } catch (err) {
      if (err instanceof AuthError) {
        callbacks.handleAuthError(err, track)
        return
      }

      if (err instanceof ServerError) {
        audioService.pause()
        toastService.error('Ошибка сервера. Повторим позже.')
        scheduleRetry(track)
        return
      }

      if (err instanceof NetworkError) {
        audioService.pause()
        toastService.error('Проблема с сетью. Повторим позже.')
        scheduleRetry(track)
        return
      }

      console.error('[player] handleStreamError: unexpected', err)
      audioService.pause()
      toastService.error('Не удалось воспроизвести трек')
    }
  }

  unsubscribers.push(
    audioService.on('loadedmetadata', ({ duration: d }) => {
      duration.value = d
      const idx = currentIndex.value
      const track = queue.value[idx]
      if (track && Math.abs((track.duration ?? 0) - d) > 0.5) {
        queue.value[idx] = { ...track, duration: d }
        if (track.pluginId) {
          callbacks.updateTrackDuration(track.id, d)
        }
      }
    }),

    audioService.on('play', () => {
      if (audioService.paused) {
        isPlaying.value = false
        return
      }

      isPlaying.value = true
      callbacks.startTimeLoop()
      const track = currentTrack.value
      if (track) {
        resetRetryCount(track.id)
        if (!isLiveStream(track.pluginId)) {
          useHistoryStore().recordPlay(track)
        }
      }
      cancelRetry()
    }),

    audioService.on('pause', () => {
      isPlaying.value = false
      void callbacks.flushPlayback()
    }),

    audioService.on('ended', () => {
      isPlaying.value = false
      callbacks.stopTimeLoop()
      void callbacks.flushPlayback()
      callbacks.handleTrackEnd()
    }),

    audioService.on('volumechange', ({ volume: v, muted: m }) => {
      volume.value = v
      muted.value = m
    }),

    audioService.on('error', ({ message, src }) => {
      console.error('[player] audio error:', message)
      isPlaying.value = false
      callbacks.stopTimeLoop()

      const track = currentTrack.value
      if (!track) {
        toastService.error(message || 'Не удалось воспроизвести трек')
        return
      }

      void handleStreamError(track, { src, message })
    }),
  )

  return {
    unsubscribeAll: () => {
      unsubscribers.forEach((fn) => fn())
      unsubscribers.length = 0
      cancelRetry()
      retryCounts.clear()
    },
  }
}
