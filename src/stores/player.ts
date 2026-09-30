// src/stores/player.ts

import { defineStore } from 'pinia'
import { ref, computed, shallowRef, watch } from 'vue'
import { audioService } from '@/services/audio/AudioService'
import { persistenceService } from '@/services/persistence/PersistenceService'
import { restoreTracks } from '@/services/persistence/restore'
import type { Track } from '@/types/track'
import { useHistoryStore } from './history'
import { createLibraryWriter } from './library'
import { useDislikesStore } from './dislikes'

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

  function startTimeLoop() {
    if (rafId !== null) return
    const tick = () => {
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

  function stopTimeLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

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

        // Обновляем duration в библиотеке (если это LibraryTrack с pluginId)
        if (track.pluginId) {
          libraryWriter.updateTrackDuration(track.id, d)
        }
      }
    }),
    audioService.on('play', () => {
      isPlaying.value = true
      startTimeLoop()
      const track = currentTrack.value
      if (track) {
        useHistoryStore().recordPlay(track)
      }
    }),
    audioService.on('pause', () => {
      isPlaying.value = false
    }),
    audioService.on('ended', () => {
      isPlaying.value = false
      stopTimeLoop()
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

  // --- Computed -------------------------------------------------------

  const hasNext = computed(() => {
    if (shuffle.value) return queue.value.length > 1
    if (repeatMode.value === 'all') return queue.value.length > 0
    return currentIndex.value < queue.value.length - 1
  })

  const hasPrev = computed(() => {
    if (shuffle.value) return queue.value.length > 1
    if (repeatMode.value === 'all') return queue.value.length > 0
    return currentIndex.value > 0
  })

  const progress = computed(() => {
    if (!duration.value) return 0
    return currentTime.value / duration.value
  })

  // Автосохранение при изменениях
  let saveScheduled = false
  function scheduleSave() {
    if (saveScheduled) return
    saveScheduled = true

    queueMicrotask(() => {
      saveScheduled = false
      persistenceService.scheduleSave({
        tracks: queue.value.map((t) => persistenceService.toPersisted(t)),
        currentIndex: currentIndex.value,
        currentTime: currentTime.value,
        volume: volume.value,
        muted: muted.value,
        repeatMode: repeatMode.value,
        shuffle: shuffle.value,
        savedAt: Date.now(),
      })
    })
  }

  watch([queue, currentIndex, currentTime, volume, muted, repeatMode, shuffle], scheduleSave, {
    deep: false,
  })

  if (typeof window !== 'undefined') {
    const flush = () => {
      persistenceService.saveNow({
        tracks: queue.value.map((t) => persistenceService.toPersisted(t)),
        currentIndex: currentIndex.value,
        currentTime: currentTime.value,
        volume: volume.value,
        muted: muted.value,
        repeatMode: repeatMode.value,
        shuffle: shuffle.value,
        savedAt: Date.now(),
      })
    }

    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }

  // Восстановление
  async function restore(): Promise<boolean> {
    const state = await persistenceService.load()
    if (!state || state.tracks.length === 0) return false

    const tracks = await restoreTracks(state.tracks)
    if (tracks.length === 0) return false

    queue.value = tracks
    currentIndex.value = state.currentIndex
    currentTrack.value = tracks[state.currentIndex] ?? null
    volume.value = state.volume
    muted.value = state.muted
    repeatMode.value = state.repeatMode
    shuffle.value = state.shuffle

    audioService.setVolume(state.volume)
    audioService.setMuted(state.muted)

    const track = tracks[state.currentIndex]
    if (track && track.source) {
      audioService.load(track.source)

      const unsub = audioService.on('loadedmetadata', () => {
        audioService.seek(state.currentTime)
        unsub()
      })
    }

    return true
  }

  // --- Действия -------------------------------------------------------

  function setQueue(tracks: Track[], startIndex = 0) {
    queue.value = tracks
    if (tracks.length === 0) {
      currentIndex.value = -1
      currentTrack.value = null
      return
    }
    const safeIndex = Math.min(Math.max(startIndex, 0), tracks.length - 1)
    playAt(safeIndex)
  }

  function playAt(index: number) {
    const track = queue.value[index]
    if (!track) return

    currentIndex.value = index
    currentTrack.value = track
    duration.value = 0
    currentTime.value = 0

    audioService.load(track.source)
    audioService.play().catch(() => {})
  }

  function play() {
    if (currentTrack.value === null && queue.value.length > 0) {
      playAt(0)
      return
    }
    audioService.play().catch(() => {})
  }

  function pause() {
    audioService.pause()
  }

  function stop(): void {
    audioService.unload()
    audioService.pause()
    audioService.seek(0)

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

  function toggle() {
    if (isPlaying.value) pause()
    else play()
  }

  function next() {
    if (queue.value.length === 0) return

    const dislikes = useDislikesStore()

    if (shuffle.value) {
      const idx = pickRandomNonDislikedIndex(dislikes.dislikedIds)
      if (idx !== -1) {
        playAt(idx)
      } else {
        isPlaying.value = false
        audioService.pause()
      }
      return
    }

    const nextIndex = findNonDislikedIndex(currentIndex.value + 1, 1, dislikes.dislikedIds)
    if (nextIndex !== -1) {
      playAt(nextIndex)
      return
    }

    if (repeatMode.value === 'all') {
      const wrapIndex = findNonDislikedIndex(0, 1, dislikes.dislikedIds)
      if (wrapIndex !== -1) {
        playAt(wrapIndex)
        return
      }
    }

    isPlaying.value = false
    audioService.pause()
  }

  function prev() {
    if (queue.value.length === 0) return

    if (audioService.currentTime > 3) {
      audioService.seek(0)
      return
    }

    const dislikes = useDislikesStore()

    if (shuffle.value) {
      const idx = pickRandomNonDislikedIndex(dislikes.dislikedIds)
      if (idx !== -1) playAt(idx)
      return
    }

    const prevIndex = findNonDislikedIndex(currentIndex.value - 1, -1, dislikes.dislikedIds)
    if (prevIndex !== -1) {
      playAt(prevIndex)
      return
    }

    if (repeatMode.value === 'all') {
      const wrapIndex = findNonDislikedIndex(queue.value.length - 1, -1, dislikes.dislikedIds)
      if (wrapIndex !== -1) {
        playAt(wrapIndex)
        return
      }
    }

    audioService.seek(0)
  }

  function seek(time: number) {
    audioService.seek(time)
    currentTime.value = Math.round(audioService.currentTime * 10) / 10
  }

  function seekBy(delta: number) {
    seek(audioService.currentTime + delta)
  }

  function setVolume(v: number) {
    audioService.setVolume(v)
  }

  function setVolumeBy(delta: number): void {
    audioService.setVolume(audioService.volume + delta)
  }

  function toggleMute() {
    audioService.setMuted(!audioService.muted)
  }

  function cycleRepeat() {
    repeatMode.value =
      repeatMode.value === 'off' ? 'all' : repeatMode.value === 'all' ? 'one' : 'off'
  }

  function toggleShuffle() {
    shuffle.value = !shuffle.value
  }

  // --- Внутренние хелперы ---------------------------------------------

  /**
   * Ближайший не-дизлайкнутый индекс, начиная с `from`, шагая `dir`.
   * `dir`: +1 — вперёд, -1 — назад. `-1`, если не нашли.
   */
  function findNonDislikedIndex(from: number, dir: 1 | -1, disliked: Set<string>): number {
    for (let i = from; i >= 0 && i < queue.value.length; i += dir) {
      const track = queue.value[i]
      if (track && !disliked.has(track.id)) return i
    }
    return -1
  }

  /** Случайный не-дизлайкнутый индекс, кроме текущего. `-1`, если не нашли. */
  function pickRandomNonDislikedIndex(disliked: Set<string>): number {
    if (queue.value.length <= 1) return -1
    const candidates: number[] = []
    for (let i = 0; i < queue.value.length; i++) {
      const track = queue.value[i]
      if (track && i !== currentIndex.value && !disliked.has(track.id)) {
        candidates.push(i)
      }
    }
    if (candidates.length === 0) return -1
    return candidates[Math.floor(Math.random() * candidates.length)]!
  }

  function handleTrackEnd() {
    if (repeatMode.value === 'one') {
      audioService.seek(0)
      audioService.play().catch(() => {})
      return
    }
    next()
  }

  // --- Очистка --------------------------------------------------------

  function $dispose() {
    stopTimeLoop()
    unsubscribers.forEach((fn) => fn())
    unsubscribers.length = 0
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
