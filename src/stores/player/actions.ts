// src/stores/player/actions.ts

import type { Ref, ShallowRef } from 'vue'
import { audioService } from '@/services/audio/AudioService'
import { resolveTrackSource } from '@/services/audio/resolveTrackSource'
import { useDislikesStore } from '../dislikes'
import { isLiveStream } from '@/plugins/registry'
import { shuffleArray, findNonDislikedIndexFrom, findNonDislikedIndex } from './playerHelpers'
import { toastService } from '@/services/ui/ToastService'
import type { Track } from '@/types/track'

export interface PlayerActionsRefs {
  queue: Ref<Track[]>
  currentIndex: Ref<number>
  currentTrack: ShallowRef<Track | null>
  isPlaying: Ref<boolean>
  duration: Ref<number>
  currentTime: Ref<number>
  repeatMode: Ref<'off' | 'one' | 'all'>
  shuffle: Ref<boolean>
}

export interface PlayerActionsCallbacks {
  syncCurrentTime: () => void
  stopTimeLoop: () => void
}

export interface PlayerActions {
  setQueue: (tracks: Track[], startIndex?: number) => void
  playAll: (tracks: Track[]) => void
  playAt: (index: number) => Promise<void>
  play: () => void
  pause: () => void
  stop: () => void
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (time: number) => void
  seekBy: (delta: number) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
  setVolume: (v: number) => void
  setVolumeBy: (delta: number) => void
  toggleMute: () => void
  cycleRepeat: () => void
  toggleShuffle: () => void
  handleTrackEnd: () => void
}

export function createPlayerActions(
  refs: PlayerActionsRefs,
  callbacks: PlayerActionsCallbacks,
): PlayerActions {
  const {
    queue,
    currentIndex,
    currentTrack,
    isPlaying,
    duration,
    currentTime,
    repeatMode,
    shuffle,
  } = refs

  const { syncCurrentTime, stopTimeLoop } = callbacks

  async function playAt(index: number): Promise<void> {
    const track = queue.value[index]
    if (!track) return

    currentIndex.value = index
    currentTrack.value = track
    duration.value = 0
    currentTime.value = 0

    let source: string | File
    try {
      source = await resolveTrackSource(track)
    } catch (err) {
      console.error('[player] resolveTrackSource failed', err)
      toastService.error('Не удалось загрузить трек')
      return
    }

    audioService.load(source)
    audioService.play().catch((err) => {
      console.error('[player] play rejected', err)
    })
  }

  function setQueue(tracks: Track[], startIndex = 0): void {
    if (tracks.length === 0) {
      queue.value = []
      currentIndex.value = -1
      currentTrack.value = null
      return
    }

    const dislikes = useDislikesStore()
    const fromIndex = Math.min(Math.max(startIndex, 0), tracks.length - 1)
    const firstPlayable = findNonDislikedIndexFrom(tracks, fromIndex, dislikes.dislikedIds)
    const safeIndex = firstPlayable !== -1 ? firstPlayable : fromIndex

    queue.value = tracks
    void playAt(safeIndex)
  }

  function playAll(tracks: Track[]): void {
    if (tracks.length === 0) return

    const dislikes = useDislikesStore()

    if (shuffle.value) {
      const shuffled = shuffleArray(tracks)
      const firstPlayable = shuffled.findIndex((t) => !dislikes.isDisliked(t.id))
      const safeIndex = firstPlayable !== -1 ? firstPlayable : 0

      queue.value = shuffled
      void playAt(safeIndex)
    } else {
      const firstPlayable = findNonDislikedIndexFrom(tracks, 0, dislikes.dislikedIds)
      const safeIndex = firstPlayable !== -1 ? firstPlayable : 0

      queue.value = tracks
      void playAt(safeIndex)
    }
  }

  function play(): void {
    if (currentTrack.value === null && queue.value.length > 0) {
      void playAt(0)
      return
    }
    audioService.play().catch((err) => {
      console.error('[player] play rejected', err)
    })
  }

  function pause(): void {
    audioService.pause()
  }

  function stop(): void {
    audioService.unload()
    audioService.pause()

    queue.value = []
    currentIndex.value = -1
    currentTrack.value = null
    currentTime.value = 0
    duration.value = 0
    isPlaying.value = false

    stopTimeLoop()
  }

  function toggle(): void {
    if (isPlaying.value) pause()
    else play()
  }

  function removeFromQueue(index: number): void {
    if (index < 0 || index >= queue.value.length) return

    const wasCurrent = index === currentIndex.value
    const wasBeforeCurrent = index < currentIndex.value

    queue.value = queue.value.filter((_, i) => i !== index)

    if (queue.value.length === 0) {
      stop()
      return
    }

    if (wasCurrent) {
      const nextIndex = Math.min(index, queue.value.length - 1)
      void playAt(nextIndex)
    } else if (wasBeforeCurrent) {
      currentIndex.value = currentIndex.value - 1
      currentTrack.value = queue.value[currentIndex.value] ?? null
    }
  }

  function clearQueue(): void {
    stop()
  }

  function next(): void {
    if (queue.value.length === 0) return
    if (currentTrack.value && isLiveStream(currentTrack.value.pluginId)) return

    const dislikes = useDislikesStore()

    const nextIndex = findNonDislikedIndex(
      queue.value,
      currentIndex.value + 1,
      1,
      dislikes.dislikedIds,
    )
    if (nextIndex !== -1) {
      void playAt(nextIndex)
      return
    }

    if (repeatMode.value === 'all') {
      const wrapIndex = findNonDislikedIndex(queue.value, 0, 1, dislikes.dislikedIds)
      if (wrapIndex !== -1) {
        void playAt(wrapIndex)
        return
      }
    }

    if (shuffle.value) {
      const currentId = currentTrack.value?.id
      const rest = queue.value.filter((t) => t.id !== currentId)
      const reshuffled = shuffleArray(rest)
      if (reshuffled.length > 0) {
        queue.value = reshuffled
        const firstPlayable = reshuffled.findIndex((t) => !dislikes.isDisliked(t.id))
        if (firstPlayable !== -1) {
          void playAt(firstPlayable)
          return
        }
      }
    }

    isPlaying.value = false
    audioService.pause()
  }

  function prev(): void {
    if (queue.value.length === 0) return
    if (currentTrack.value && isLiveStream(currentTrack.value.pluginId)) return

    if (audioService.currentTime > 3) {
      audioService.seek(0)
      return
    }

    const dislikes = useDislikesStore()

    const prevIndex = findNonDislikedIndex(
      queue.value,
      currentIndex.value - 1,
      -1,
      dislikes.dislikedIds,
    )
    if (prevIndex !== -1) {
      void playAt(prevIndex)
      return
    }

    if (repeatMode.value === 'all') {
      const wrapIndex = findNonDislikedIndex(
        queue.value,
        queue.value.length - 1,
        -1,
        dislikes.dislikedIds,
      )
      if (wrapIndex !== -1) {
        void playAt(wrapIndex)
        return
      }
    }

    audioService.seek(0)
  }

  function seek(time: number): void {
    audioService.seek(time)
    syncCurrentTime()
  }

  function seekBy(delta: number): void {
    seek(audioService.currentTime + delta)
  }

  function setVolume(v: number): void {
    audioService.setVolume(v)
  }

  function setVolumeBy(delta: number): void {
    audioService.setVolume(audioService.volume + delta)
  }

  function toggleMute(): void {
    audioService.setMuted(!audioService.muted)
  }

  function cycleRepeat(): void {
    repeatMode.value =
      repeatMode.value === 'off' ? 'all' : repeatMode.value === 'all' ? 'one' : 'off'
  }

  function toggleShuffle(): void {
    shuffle.value = !shuffle.value

    if (shuffle.value && queue.value.length > 1) {
      const current = queue.value[currentIndex.value]
      if (!current) return

      const played = queue.value.slice(0, currentIndex.value + 1)
      const remaining = queue.value.slice(currentIndex.value + 1)
      if (remaining.length === 0) return

      queue.value = [...played, ...shuffleArray(remaining)]
    }
  }

  function handleTrackEnd(): void {
    if (repeatMode.value === 'one') {
      audioService.seek(0)
      audioService.play().catch(() => {})
      return
    }
    next()
  }

  return {
    setQueue,
    playAll,
    playAt,
    play,
    pause,
    stop,
    toggle,
    next,
    prev,
    seek,
    seekBy,
    removeFromQueue,
    clearQueue,
    setVolume,
    setVolumeBy,
    toggleMute,
    cycleRepeat,
    toggleShuffle,
    handleTrackEnd,
  }
}
