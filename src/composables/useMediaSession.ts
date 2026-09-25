// src/composables/useMediaSession.ts

import { watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import type { Track } from '@/types/track'

interface MediaSessionOptions {
  currentTrack: Ref<Track | null>
  isPlaying: Ref<boolean>
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (time: number) => void
  onSeekBy: (delta: number) => void
}

/**
 * Связывает состояние плеера с Media Session API.
 * Работает в Chrome/Edge/Safari (частично), в Firefox — no-op.
 */
export function useMediaSession(options: MediaSessionOptions) {
  const supported = typeof navigator !== 'undefined' && 'mediaSession' in navigator

  if (!supported) {
    return { supported: false }
  }

  const { currentTrack, isPlaying, onPlay, onPause, onNext, onPrev, onSeek, onSeekBy } = options

  // --- Action handlers --------------------------------------------------

  navigator.mediaSession.setActionHandler('play', () => onPlay())
  navigator.mediaSession.setActionHandler('pause', () => onPause())
  navigator.mediaSession.setActionHandler('nexttrack', () => onNext())
  navigator.mediaSession.setActionHandler('previoustrack', () => onPrev())

  // seekbackward / seekforward — опциональны, но приятны
  navigator.mediaSession.setActionHandler('seekbackward', (details) => {
    onSeekBy(-(details.seekOffset ?? 10))
  })
  navigator.mediaSession.setActionHandler('seekforward', (details) => {
    onSeekBy(details.seekOffset ?? 10)
  })

  // seekto — нужен для перемотки с локскрина
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime != null) {
      onSeek(details.seekTime)
    }
  })

  // --- Синхронизация метаданных ----------------------------------------

  watch(currentTrack, (track) => {
    if (!track) {
      navigator.mediaSession.metadata = null
      return
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.coverUrl
        ? [
            {
              src: track.coverUrl,
              sizes: '512x512',
              type: 'image/jpeg',
            },
          ]
        : [],
    })
  })

  // --- Синхронизация playbackState -------------------------------------

  watch(isPlaying, (playing) => {
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  })

  // --- Очистка при unmount ---------------------------------------------

  onUnmounted(() => {
    navigator.mediaSession.metadata = null
    navigator.mediaSession.playbackState = 'none'

    const actions = [
      'play',
      'pause',
      'nexttrack',
      'previoustrack',
      'seekbackward',
      'seekforward',
      'seekto',
    ] as const

    for (const action of actions) {
      navigator.mediaSession.setActionHandler(action, null)
    }
  })

  return { supported: true }
}
