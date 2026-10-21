// src/stores/player.ts

import { defineStore } from 'pinia'
import { ref, computed, shallowRef, watch } from 'vue'
import { audioService } from '@/services/audio/AudioService'
import { persistenceService } from '@/services/persistence/PersistenceService'
import type { Track } from '@/types/track'
import { useHistoryStore } from './history'
import { useDislikesStore } from './dislikes'
import { createLibraryWriter } from './library'
import { isLiveStream } from '@/plugins/registry'
import {
  shuffleArray,
  findNonDislikedIndexFrom,
  findNonDislikedIndex,
} from './player/playerHelpers'
import { createPlayerPersistence } from './player/playerPersistence'
import { restorePlayerState, applyRestoredPlayback } from './player/playerRestore'

export const usePlayerStore = defineStore('player', () => {
  // --- Состояние ------------------------------------------------------
  const queue = ref<Track[]>([])
  const currentIndex = ref(-1)
  const isPlaying = ref(false)
  const duration = ref(0)
  const currentTime = ref(0)
  const volume = ref(1)
  const muted = ref(false)
  const repeatMode = ref<'off' | 'one' | 'all'>('off')
  const shuffle = ref(false)

  const currentTrack = shallowRef<Track | null>(null)

  // --- rAF-цикл для currentTime ---------------------------------------
  let rafId: number | null = null

  function startTimeLoop(): void {
    if (rafId !== null) return
    const tick = (): void => {
      const t = Math.round(audioService.currentTime * 10) / 10
      if (t !== currentTime.value) currentTime.value = t

      if (audioService.paused && !isPlaying.value) {
        stopTimeLoop()
        return
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  function stopTimeLoop(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  function syncCurrentTime(): void {
    currentTime.value = Math.round(audioService.currentTime * 10) / 10
  }

  // --- Персистентность ------------------------------------------------
  const persistence = createPlayerPersistence({
    queue,
    currentIndex,
    currentTime,
    volume,
    muted,
    repeatMode,
    shuffle,
    currentTrack,
  })

  const { flushPlayback } = persistence

  watch([queue, currentIndex, volume, muted, repeatMode, shuffle], () => {
    persistenceService.scheduleSaveState(persistence.buildState())
  })

  watch(currentTime, () => {
    persistenceService.scheduleSavePlayback(persistence.buildPlayback())
  })

  // --- Подписка на события сервиса ------------------------------------
  const unsubscribers: Array<() => void> = []
  const libraryWriter = createLibraryWriter()

  unsubscribers.push(
    audioService.on('loadedmetadata', ({ duration: d }) => {
      duration.value = d
      const idx = currentIndex.value
      const track = queue.value[idx]
      if (track && Math.abs((track.duration ?? 0) - d) > 0.5) {
        queue.value[idx] = { ...track, duration: d }
        if (track.pluginId) {
          libraryWriter.updateTrackDuration(track.id, d)
        }
      }
    }),
    audioService.on('play', () => {
      isPlaying.value = true
      startTimeLoop()
      const track = currentTrack.value
      if (track && !isLiveStream(track.pluginId)) {
        useHistoryStore().recordPlay(track)
      }
    }),
    audioService.on('pause', () => {
      isPlaying.value = false
      void flushPlayback()
    }),
    audioService.on('ended', () => {
      isPlaying.value = false
      stopTimeLoop()
      void flushPlayback()
      handleTrackEnd()
    }),
    audioService.on('volumechange', ({ volume: v, muted: m }) => {
      volume.value = v
      muted.value = m
    }),
    audioService.on('error', ({ message }) => {
      console.error('[player] audio error:', message)
      isPlaying.value = false
      stopTimeLoop()
    }),
  )

  // --- beforeunload / visibilitychange --------------------------------
  const unsubFlush = persistence.subscribeFlushOnUnload()

  // --- Computed -------------------------------------------------------
  const hasNext = computed(() => {
    if (queue.value.length === 0) return false
    if (shuffle.value) return queue.value.length > 1
    if (repeatMode.value === 'all') return true
    return currentIndex.value < queue.value.length - 1
  })

  const hasPrev = computed(() => {
    if (queue.value.length === 0) return false
    if (shuffle.value) return queue.value.length > 1
    if (repeatMode.value === 'all') return true
    return currentIndex.value > 0
  })

  const progress = computed(() => {
    if (!duration.value) return 0
    return currentTime.value / duration.value
  })

  // --- Восстановление -------------------------------------------------
  async function restore(): Promise<boolean> {
    const restored = await restorePlayerState()
    if (!restored) return false

    queue.value = restored.tracks
    currentIndex.value = restored.currentIndex
    currentTrack.value = restored.tracks[restored.currentIndex] ?? null
    volume.value = restored.volume
    muted.value = restored.muted
    repeatMode.value = restored.repeatMode
    shuffle.value = restored.shuffle

    audioService.setVolume(restored.volume)
    audioService.setMuted(restored.muted)

    await applyRestoredPlayback(restored.tracks, restored.currentIndex, (t) => {
      currentTime.value = Math.round(t * 10) / 10
    })

    return true
  }

  // --- Действия -------------------------------------------------------

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
    playAt(safeIndex)
  }

  function playAll(tracks: Track[]): void {
    if (tracks.length === 0) return

    const dislikes = useDislikesStore()

    if (shuffle.value) {
      const shuffled = shuffleArray(tracks)
      const firstPlayable = shuffled.findIndex((t) => !dislikes.isDisliked(t.id))
      const safeIndex = firstPlayable !== -1 ? firstPlayable : 0

      queue.value = shuffled
      playAt(safeIndex)
    } else {
      const firstPlayable = findNonDislikedIndexFrom(tracks, 0, dislikes.dislikedIds)
      const safeIndex = firstPlayable !== -1 ? firstPlayable : 0

      queue.value = tracks
      playAt(safeIndex)
    }
  }

  function playAt(index: number): void {
    const track = queue.value[index]
    if (!track) return

    currentIndex.value = index
    currentTrack.value = track
    duration.value = 0
    currentTime.value = 0

    audioService.load(track.source)
    audioService.play().catch(() => {})
  }

  function play(): void {
    if (currentTrack.value === null && queue.value.length > 0) {
      playAt(0)
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
      playAt(nextIndex)
    } else if (wasBeforeCurrent) {
      currentIndex.value = currentIndex.value - 1
      currentTrack.value = queue.value[currentIndex.value] ?? null
    }
  }

  function clearQueue(): void {
    stop()
  }

  function toggle(): void {
    if (isPlaying.value) pause()
    else play()
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
      playAt(nextIndex)
      return
    }

    if (repeatMode.value === 'all') {
      const wrapIndex = findNonDislikedIndex(queue.value, 0, 1, dislikes.dislikedIds)
      if (wrapIndex !== -1) {
        playAt(wrapIndex)
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
          playAt(firstPlayable)
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
      playAt(prevIndex)
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
        playAt(wrapIndex)
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

  // --- Очистка --------------------------------------------------------
  function $dispose(): void {
    stopTimeLoop()
    unsubscribers.forEach((fn) => fn())
    unsubscribers.length = 0
    unsubFlush()
  }

  return {
    queue,
    currentIndex,
    currentTrack,
    isPlaying,
    duration,
    currentTime,
    volume,
    muted,
    repeatMode,
    shuffle,

    hasNext,
    hasPrev,
    progress,

    setQueue,
    playAll,
    playAt,
    play,
    pause,
    stop,
    removeFromQueue,
    clearQueue,
    toggle,
    next,
    prev,
    seek,
    seekBy,
    setVolume,
    setVolumeBy,
    toggleMute,
    cycleRepeat,
    toggleShuffle,
    restore,

    $dispose,
  }
})
