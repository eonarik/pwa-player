// src/stores/player.ts

import { defineStore } from 'pinia'
import { ref, computed, shallowRef, watch } from 'vue'
import { audioService } from '@/services/audio/AudioService'
import { metadataService } from '@/services/metadata/MetadataService'
import { getParentFolderName } from '@/services/metadata/utils'
import { fileSystemService } from '@/services/filesystem/FileSystemService'
import { persistenceService } from '@/services/persistence/PersistenceService'
import { restoreTracks } from '@/services/persistence/restore'
import type { Track } from '@/types/track'
import type { FileEntry } from '@/services/filesystem/types'

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

  // shallowRef — потому что мы не мутируем треки, а заменяем целиком.
  // Это дешевле для Vue и не создаёт лишних proxy.
  const currentTrack = shallowRef<Track | null>(null)

  // --- rAF-цикл для currentTime ---------------------------------------

  let rafId: number | null = null

  function startTimeLoop() {
    if (rafId !== null) return
    const tick = () => {
      // Округляем до 0.1 — ререндеры раз в 100мс вместо 16мс
      const t = Math.round(audioService.currentTime * 10) / 10
      if (t !== currentTime.value) currentTime.value = t

      // Если трек закончился — rAF всё равно не остановится, поэтому
      // проверяем paused и сами гасим цикл
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

  // unsubscribe-функции, чтобы снять всё при dispose стора
  const unsubscribers: Array<() => void> = []

  unsubscribers.push(
    audioService.on('loadedmetadata', ({ duration: d }) => {
      duration.value = d
      // Обновляем длительность в треке, если она отличается
      const idx = currentIndex.value
      const track = queue.value[idx]
      if (track && Math.abs((track.duration ?? 0) - d) > 0.5) {
        queue.value[idx] = { ...track, duration: d }
      }
    }),
    audioService.on('play', () => {
      isPlaying.value = true
      startTimeLoop()
    }),
    audioService.on('pause', () => {
      isPlaying.value = false
      // Не гасим цикл сразу — вдруг это seek во время паузы.
      // Цикл сам остановится на следующем кадре.
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

    // Микротаск-дебаунс: соберём все изменения в один вызов
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

  // Сохранение при закрытии — важно для currentTime
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

    // Освобождаем старые обложки
    queue.value.forEach((t) => metadataService.revokeCover(t.coverUrl))

    const tracks = await restoreTracks(state.tracks)
    if (tracks.length === 0) return false

    queue.value = tracks
    currentIndex.value = state.currentIndex
    currentTrack.value = tracks[state.currentIndex] ?? null
    volume.value = state.volume
    muted.value = state.muted
    repeatMode.value = state.repeatMode
    shuffle.value = state.shuffle

    // Восстанавливаем громкость в AudioService
    audioService.setVolume(state.volume)
    audioService.setMuted(state.muted)

    // Загружаем трек, но НЕ играем и не seek'аем сразу —
    // seek нужно делать после loadedmetadata
    const track = tracks[state.currentIndex]
    if (track && track.source) {
      audioService.load(track.source)

      // Ждём метаданные, потом seek
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
    audioService.play().catch(() => {
      // play() уже эмитит error, здесь просто глушим необработанный промис
    })
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

  /**
   * Полная остановка: пауза, очистка очереди, сброс текущего трека.
   * Используется при смене источника библиотеки или явном «стоп».
   */
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

  function toggle() {
    if (isPlaying.value) pause()
    else play()
  }

  function next() {
    if (queue.value.length === 0) return

    if (shuffle.value) {
      playAt(pickRandomIndex())
      return
    }

    if (currentIndex.value < queue.value.length - 1) {
      playAt(currentIndex.value + 1)
    } else if (repeatMode.value === 'all') {
      playAt(0)
    } else {
      // конец очереди, repeat off
      isPlaying.value = false
    }
  }

  function prev() {
    if (queue.value.length === 0) return

    // UX-правило: если трек играет больше 3 сек — prev перематывает в начало
    if (audioService.currentTime > 3) {
      audioService.seek(0)
      return
    }

    if (shuffle.value) {
      playAt(pickRandomIndex())
      return
    }

    if (currentIndex.value > 0) {
      playAt(currentIndex.value - 1)
    } else if (repeatMode.value === 'all') {
      playAt(queue.value.length - 1)
    } else {
      audioService.seek(0)
    }
  }

  function seek(time: number) {
    audioService.seek(time)
    // Сразу подтягиваем currentTime, чтобы UI не ждал следующего кадра
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

  function pickRandomIndex(): number {
    if (queue.value.length <= 1) return 0
    let idx = currentIndex.value
    while (idx === currentIndex.value) {
      idx = Math.floor(Math.random() * queue.value.length)
    }
    return idx
  }

  function handleTrackEnd() {
    if (repeatMode.value === 'one') {
      audioService.seek(0)
      audioService.play().catch(() => {})
      return
    }
    next()
  }

  async function parseEntries(entries: FileEntry[], rootFolderName?: string): Promise<Track[]> {
    // уникальные директории
    const uniqueDirs = new Map<FileSystemDirectoryHandle, FileEntry[]>()
    for (const entry of entries) {
      const list = uniqueDirs.get(entry.directoryHandle) ?? []
      list.push(entry)
      uniqueDirs.set(entry.directoryHandle, list)
    }

    // обложки параллельно
    const coverCache = new Map<FileSystemDirectoryHandle, File | null>()
    const dirs = Array.from(uniqueDirs.keys())
    const COVER_CONCURRENCY = 8
    let cursor = 0
    const coverWorker = async (): Promise<void> => {
      while (cursor < dirs.length) {
        const dir = dirs[cursor++]!
        coverCache.set(dir, await fileSystemService.findCoverInDirectory(dir))
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(COVER_CONCURRENCY, dirs.length) }, () => coverWorker()),
    )

    // метаданные
    const parsed = await metadataService.readMany(
      entries.map((e) => ({
        file: e.file,
        folderName: getParentFolderName(e.path),
        coverFile: coverCache.get(e.directoryHandle) ?? null,
      })),
      { rootFolderName, concurrency: 4 },
    )

    return entries.map((entry, i) => ({
      id: crypto.randomUUID(),
      source: entry.file,
      filename: entry.file.name,
      path: entry.path,
      handle: entry.handle,
      directoryHandle: entry.directoryHandle,
      ...parsed[i]!,
    }))
  }

  async function addFiles(entries: FileEntry[], rootFolderName?: string): Promise<void> {
    const tracks = await parseEntries(entries, rootFolderName)
    queue.value = [...queue.value, ...tracks]
  }

  async function setFiles(entries: FileEntry[], rootFolderName?: string): Promise<void> {
    queue.value.forEach((t) => metadataService.revokeCover(t.coverUrl))
    const tracks = await parseEntries(entries, rootFolderName)
    queue.value = tracks
    // Сбрасываем текущий трек, потому что объекты треков — новые
    currentIndex.value = -1
    currentTrack.value = null
  }

  // --- Очистка --------------------------------------------------------

  function $dispose() {
    stopTimeLoop()
    unsubscribers.forEach((fn) => fn())
    unsubscribers.length = 0
  }

  return {
    // state
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

    // computed
    hasNext,
    hasPrev,
    progress,

    // actions
    addFiles,
    setFiles,
    setQueue,
    playAt,
    play,
    pause,
    stop,
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

    // lifecycle
    $dispose,
  }
})
