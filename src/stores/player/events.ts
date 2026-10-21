// src/stores/player/events.ts

import type { Ref, ShallowRef } from 'vue'
import { audioService } from '@/services/audio/AudioService'
import { useHistoryStore } from '../history'
import { isLiveStream } from '@/plugins/registry'
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
}

export interface AudioEvents {
  unsubscribeAll: () => void
}

/**
 * Подписка на события `audioService`. Возвращает `unsubscribeAll`
 * для `$dispose`.
 *
 * Все побочные эффекты (запись в историю, обновление длительности
 * в библиотеке, `handleTrackEnd`) — через колбэки, чтобы этот модуль
 * не зависел от Pinia.
 */
export function bindAudioEvents(
  refs: AudioEventsRefs,
  callbacks: AudioEventsCallbacks,
): AudioEvents {
  const { queue, currentIndex, currentTrack, isPlaying, duration, volume, muted } = refs

  const unsubscribers: Array<() => void> = []

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
      isPlaying.value = true
      callbacks.startTimeLoop()
      const track = currentTrack.value
      if (track && !isLiveStream(track.pluginId)) {
        useHistoryStore().recordPlay(track)
      }
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
    audioService.on('error', ({ message }) => {
      console.error('[player] audio error:', message)
      isPlaying.value = false
      callbacks.stopTimeLoop()
    }),
  )

  return {
    unsubscribeAll: () => {
      unsubscribers.forEach((fn) => fn())
      unsubscribers.length = 0
    },
  }
}
