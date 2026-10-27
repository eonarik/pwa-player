// src/stores/history.ts

import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { historyPersistenceService } from '@/services/persistence/HistoryPersistenceService'
import { HISTORY_MAX_SIZE } from '@/types/history'
import { createTrackSnapshot } from '@/utils/trackSnapshot'
import type { PlayHistoryEntry } from '@/types/history'
import type { Track } from '@/types/track'

export const useHistoryStore = defineStore('history', () => {
  // --- Состояние ------------------------------------------------------

  const entries = ref<PlayHistoryEntry[]>([])

  const isRestoring = ref(false)

  // --- Computed -------------------------------------------------------

  const sortedHistory = computed<PlayHistoryEntry[]>(() => {
    return [...entries.value].sort((a, b) => b.playedAt - a.playedAt)
  })

  const uniqueHistory = computed<PlayHistoryEntry[]>(() => {
    const seen = new Map<string, PlayHistoryEntry>()
    for (const entry of sortedHistory.value) {
      // ИСПОЛЬЗУЕМ id вместо trackId
      if (!seen.has(entry.id)) {
        seen.set(entry.id, entry)
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

  function save(): void {
    const plain = entries.value.map((e) => JSON.parse(JSON.stringify(e))) as PlayHistoryEntry[]
    historyPersistenceService.save(plain)
  }

  watch(
    entries,
    () => {
      save()
    },
    { deep: true },
  )

  async function flush(): Promise<void> {
    await historyPersistenceService.flush()
  }

  // --- Внутренние хелперы ---------------------------------------------

  function toEntry(track: Track): PlayHistoryEntry {
    return {
      ...createTrackSnapshot(track),
      playedAt: Date.now(),
    }
  }

  // --- Действия -------------------------------------------------------

  function recordPlay(track: Track): void {
    const trackId = track.id
    // ИСПОЛЬЗУЕМ id вместо trackId
    const index = entries.value.findIndex((e) => e.id === trackId)

    if (index !== -1) {
      entries.value[index] = {
        ...entries.value[index]!,
        ...toEntry(track),
      }
    } else {
      entries.value.push(toEntry(track))
    }

    if (entries.value.length > HISTORY_MAX_SIZE) {
      const sorted = [...entries.value].sort((a, b) => a.playedAt - b.playedAt)
      const toRemove = entries.value.length - HISTORY_MAX_SIZE
      // ИСПОЛЬЗУЕМ id вместо trackId
      const removeIds = new Set(sorted.slice(0, toRemove).map((e) => e.id))
      entries.value = entries.value.filter((e) => !removeIds.has(e.id))
    }
  }

  function clear(): void {
    entries.value = []
    void historyPersistenceService.clear()
  }

  function getEntry(trackId: string): PlayHistoryEntry | null {
    // ИСПОЛЬЗУЕМ id вместо trackId
    return entries.value.find((e) => e.id === trackId) ?? null
  }

  return {
    entries,
    isRestoring,

    sortedHistory,
    uniqueHistory,
    isEmpty,

    restore,
    save,
    recordPlay,
    clear,
    getEntry,
    flush,
  }
})
