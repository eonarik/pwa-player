// src/stores/player.ts

import { defineStore } from 'pinia'
import { ref, computed, shallowRef, watch } from 'vue'
import { audioService } from '@/services/audio/AudioService'
import { persistenceService } from '@/services/persistence/PersistenceService'
import { restoreTracks } from '@/services/persistence/restore'
import type { Track } from '@/types/track'
import { useHistoryStore } from './history'
import { useDislikesStore } from './dislikes'
import { createLibraryWriter, useLibraryStore } from './library'

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

  /** Синхронизирует currentTime из audioService прямо сейчас. */
  function syncCurrentTime(): void {
    currentTime.value = Math.round(audioService.currentTime * 10) / 10
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

  // --- Сохранение -----------------------------------------------------

  function buildState() {
    return {
      tracks: queue.value.map((t) => persistenceService.toPersisted(t)),
      currentIndex: currentIndex.value,
      volume: volume.value,
      muted: muted.value,
      repeatMode: repeatMode.value,
      shuffle: shuffle.value,
      savedAt: Date.now(),
    }
  }

  function buildPlayback() {
    return {
      currentTime: currentTime.value,
      trackId: currentTrack.value?.id ?? null,
      savedAt: Date.now(),
    }
  }

  watch([queue, currentIndex, volume, muted, repeatMode, shuffle], () => {
    persistenceService.scheduleSaveState(buildState())
  })

  watch(currentTime, () => {
    persistenceService.scheduleSavePlayback(buildPlayback())
  })

  async function flushPlayback(): Promise<void> {
    await persistenceService.savePlaybackNow(buildPlayback())
  }

  async function flushState(): Promise<void> {
    await persistenceService.saveStateNow(buildState())
  }

  // --- beforeunload / visibilitychange --------------------------------

  if (typeof window !== 'undefined') {
    const flush = () => {
      void flushState()
      void flushPlayback()
    }

    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }

  // --- Восстановление -------------------------------------------------

  async function restore(): Promise<boolean> {
    const state = await persistenceService.loadState()
    if (!state || state.tracks.length === 0) return false

    const tracks = await restoreTracks(state.tracks)
    if (tracks.length === 0) return false

    const library = useLibraryStore()
    for (const track of tracks) {
      const libTrack = library.getTrack(track.id)
      if (!libTrack) continue

      if (!track.coverUrl && libTrack.coverUrl) {
        track.coverUrl = libTrack.coverUrl
      }

      if (!track.source && typeof libTrack.source === 'string' && libTrack.source) {
        track.source = libTrack.source
      }
    }

    queue.value = tracks
    currentIndex.value = state.currentIndex
    currentTrack.value = tracks[state.currentIndex] ?? null
    volume.value = state.volume
    muted.value = state.muted
    repeatMode.value = state.repeatMode
    shuffle.value = state.shuffle

    audioService.setVolume(state.volume)
    audioService.setMuted(state.muted)

    const playback = await persistenceService.loadPlayback()
    const savedTime =
      playback && playback.trackId === currentTrack.value?.id ? playback.currentTime : 0

    const track = tracks[state.currentIndex]
    if (track && track.source) {
      audioService.load(track.source)

      if (savedTime > 0) {
        const unsub = audioService.on('loadedmetadata', () => {
          audioService.seek(savedTime)
          syncCurrentTime()
          unsub()
        })
      }
    }

    return true
  }

  // --- Действия -------------------------------------------------------

  /**
   * Устанавливает очередь и начинает воспроизведение.
   *
   * - При shuffle очередь перемешивается один раз (Fisher-Yates),
   *   играет первый не-дизлайкнутый.
   * - Без shuffle играет с `startIndex`, пропуская дизлайкнутые вперёд.
   * - Если все дизлайкнуты — играет с начала очереди (иначе ничего не заиграет).
   */
  function setQueue(tracks: Track[], startIndex = 0) {
    if (tracks.length === 0) {
      queue.value = []
      currentIndex.value = -1
      currentTrack.value = null
      return
    }

    const dislikes = useDislikesStore()
    let finalTracks: Track[]
    let safeIndex: number

    if (shuffle.value) {
      finalTracks = shuffleArray(tracks)
      const firstPlayable = finalTracks.findIndex((t) => !dislikes.isDisliked(t.id))
      safeIndex = firstPlayable !== -1 ? firstPlayable : 0
    } else {
      finalTracks = tracks
      const fromIndex = Math.min(Math.max(startIndex, 0), tracks.length - 1)
      const firstPlayable = findNonDislikedIndexFrom(finalTracks, fromIndex, dislikes.dislikedIds)
      safeIndex = firstPlayable !== -1 ? firstPlayable : fromIndex
    }

    queue.value = finalTracks
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
    audioService.play().catch((err) => {
      console.error('[player] play rejected', err)
    })
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

  /**
   * Следующий трек.
   *
   * При shuffle очередь уже перемешана при setQueue — идём линейно вперёд.
   * Дошли до конца — перемешиваем заново (без текущего), играем с первого
   * не-дизлайкнутого. Дизлайкнутые пропускаются.
   */
  function next() {
    if (queue.value.length === 0) return

    const dislikes = useDislikesStore()

    const nextIndex = findNonDislikedIndex(currentIndex.value + 1, 1, dislikes.dislikedIds)
    if (nextIndex !== -1) {
      playAt(nextIndex)
      return
    }

    // Конец очереди — повтор или shuffle-reset
    if (repeatMode.value === 'all') {
      const wrapIndex = findNonDislikedIndex(0, 1, dislikes.dislikedIds)
      if (wrapIndex !== -1) {
        playAt(wrapIndex)
        return
      }
    }

    if (shuffle.value) {
      // Перемешиваем всё заново, исключая текущий
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

  /**
   * Предыдущий трек.
   *
   * При shuffle — линейно назад (очередь уже перемешана).
   * Если играет > 3 сек — сначала seek в начало.
   */
  function prev() {
    if (queue.value.length === 0) return

    if (audioService.currentTime > 3) {
      audioService.seek(0)
      return
    }

    const dislikes = useDislikesStore()

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
    syncCurrentTime()
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

  /**
   * Включает/выключает shuffle.
   * При включении во время воспроизведения — перемешивает оставшиеся
   * треки (после текущего), проигранные не трогает.
   */
  function toggleShuffle() {
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

  // --- Внутренние хелперы ---------------------------------------------

  /** Перемешивание массива (Fisher-Yates) — не мутирует исходный */
  function shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j]!, result[i]!]
    }
    return result
  }

  /** Ищет не-дизлайкнутый индекс начиная с `from`, двигаясь вперёд */
  function findNonDislikedIndexFrom(tracks: Track[], from: number, disliked: Set<string>): number {
    for (let i = from; i < tracks.length; i++) {
      const t = tracks[i]
      if (t && !disliked.has(t.id)) return i
    }
    return -1
  }

  function findNonDislikedIndex(from: number, dir: 1 | -1, disliked: Set<string>): number {
    for (let i = from; i >= 0 && i < queue.value.length; i += dir) {
      const track = queue.value[i]
      if (track && !disliked.has(track.id)) return i
    }
    return -1
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
