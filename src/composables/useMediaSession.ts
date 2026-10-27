// src/composables/useMediaSession.ts

import { watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import { isLiveStream } from '@/plugins/registry'
import type { Track } from '@/types/track'
import { useLibraryStore } from '@/stores/library'

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

export function useMediaSession(options: MediaSessionOptions) {
  const supported = typeof navigator !== 'undefined' && 'mediaSession' in navigator

  if (!supported) {
    return { supported: false }
  }

  const { currentTrack, isPlaying, onPlay, onPause, onNext, onPrev, onSeek, onSeekBy } = options

  function isCurrentLive(): boolean {
    const track = currentTrack.value
    return track ? isLiveStream(track.pluginId) : false
  }

  function safeNext(): void {
    if (isCurrentLive()) return
    onNext()
  }

  function safePrev(): void {
    if (isCurrentLive()) return
    onPrev()
  }

  function safeSeek(time: number): void {
    if (isCurrentLive()) return
    onSeek(time)
  }

  function safeSeekBy(delta: number): void {
    if (isCurrentLive()) return
    onSeekBy(delta)
  }

  navigator.mediaSession.setActionHandler('play', () => onPlay())
  navigator.mediaSession.setActionHandler('pause', () => onPause())
  navigator.mediaSession.setActionHandler('nexttrack', () => safeNext())
  navigator.mediaSession.setActionHandler('previoustrack', () => safePrev())

  navigator.mediaSession.setActionHandler('seekbackward', (details) => {
    safeSeekBy(-(details.seekOffset ?? 10))
  })
  navigator.mediaSession.setActionHandler('seekforward', (details) => {
    safeSeekBy(details.seekOffset ?? 10)
  })

  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime != null) {
      safeSeek(details.seekTime)
    }
  })

  watch(
    currentTrack,
    (track) => {
      if (!track) {
        navigator.mediaSession.metadata = null
        return
      }

      const library = useLibraryStore()
      const album = track.albumId ? library.getAlbum(track.albumId) : null
      const coverUrl = album?.coverUrl

      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: coverUrl
          ? [
              {
                src: coverUrl,
                sizes: '512x512',
                type: 'image/jpeg',
              },
            ]
          : [],
      })
    },
    { immediate: true },
  )

  watch(
    isPlaying,
    (playing) => {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
    },
    { immediate: true },
  )

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
