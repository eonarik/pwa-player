// src/stores/history.ts

import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { historyPersistenceService } from '@/services/persistence/HistoryPersistenceService'
import { HISTORY_MAX_SIZE } from '@/types/history'
import type { PlayHistoryEntry } from '@/types/history'
import type { Track } from '@/types/track'

export const useHistoryStore = defineStore('history', () => {
  // --- Состояние ------------------------------------------------------

  /**
   * Записи в порядке добавления. Свежие всегда добавляются в конец
   * (или перемещаются в конец при повторе). Сортировка для UI — отдельно.
   */
  const entries = ref<PlayHistoryEntry[]>([])

  const isRestoring = ref(false)

  // --- Computed -------------------------------------------------------

  /** История, отсортированная по свежести (свежие сверху) */
  const sortedHistory = computed<PlayHistoryEntry[]>(() => {
    return [...entries.value].sort((a, b) => b.playedAt - a.playedAt)
  })

  /** Уникальные треки — если один трек играл несколько раз, показываем один раз */
  const uniqueHistory = computed<PlayHistoryEntry[]>(() => {
    const seen = new Map<string, PlayHistoryEntry>()
    for (const entry of sortedHistory.value) {
      if (!seen.has(entry.trackId)) {
        seen.set(entry.trackId, entry)
      }
    }
    return Array.from(seen.values())
  })

  const isEmpty = computed(() => entries.value.length === 0)

  // --- Восстановление и сохранение ------------------------------------

  async function restore(): Promise<boolean> {
    isRestoring.value = true
    try {
      const loaded = await historyPersistenceService.load()
      if (loaded && loaded.length > 0) {
        entries.value = loaded
        return true
      }
      return false
    } finally {
      isRestoring.value = false
    }
  }

  async function save(): Promise<void> {
    const plain = entries.value.map((e) => JSON.parse(JSON.stringify(e))) as PlayHistoryEntry[]
    await historyPersistenceService.save(plain)
  }

  watch(
    entries,
    () => {
      void save()
    },
    { deep: true },
  )

  // --- Внутренние хелперы ---------------------------------------------

  function toEntry(track: Track): PlayHistoryEntry {
    const remotePath = (track as { remotePath?: string }).remotePath
    return {
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      remotePath,
      playedAt: Date.now(),
    }
  }

  // --- Действия -------------------------------------------------------

  /**
   * Записывает факт воспроизведения.
   * Если трек уже есть в истории — обновляем playedAt и перемещаем в конец.
   * Если нет — добавляем.
   * Если превышен лимит — вытесняем самые старые.
   */
  function recordPlay(track: Track): void {
    const trackId = track.id
    const index = entries.value.findIndex((e) => e.trackId === trackId)

    if (index !== -1) {
      // Обновляем существующую запись
      entries.value[index] = {
        ...entries.value[index]!,
        ...toEntry(track),
      }
      // Перемещаем в конец (или можно оставить как есть и сортировать по playedAt)
    } else {
      entries.value.push(toEntry(track))
    }

    // Ограничиваем размер
    if (entries.value.length > HISTORY_MAX_SIZE) {
      // Удаляем самые старые по playedAt
      const sorted = [...entries.value].sort((a, b) => a.playedAt - b.playedAt)
      const toRemove = entries.value.length - HISTORY_MAX_SIZE
      const removeIds = new Set(sorted.slice(0, toRemove).map((e) => e.trackId))
      entries.value = entries.value.filter((e) => !removeIds.has(e.trackId))
    }
  }

  /** Очистить историю */
  function clear(): void {
    entries.value = []
    void historyPersistenceService.clear()
  }

  /** Получить запись по trackId */
  function getEntry(trackId: string): PlayHistoryEntry | null {
    return entries.value.find((e) => e.trackId === trackId) ?? null
  }

  return {
    // state
    entries,
    isRestoring,

    // computed
    sortedHistory,
    uniqueHistory,
    isEmpty,

    // actions
    restore,
    save,
    recordPlay,
    clear,
    getEntry,
  }
})
