// src/stores/history.ts

import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { historyPersistenceService } from '@/services/persistence/HistoryPersistenceService'
import { HISTORY_MAX_SIZE } from '@/types/history'
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
    const remotePath = (track as { remotePath?: string }).remotePath
    return {
      trackId: track.id,
      pluginId: track.pluginId,
      title: track.title,
      artist: track.artist,
      album: track.album,
      remotePath,
      playedAt: Date.now(),
    }
  }

  // --- Действия -------------------------------------------------------

  function recordPlay(track: Track): void {
    const trackId = track.id
    const index = entries.value.findIndex((e) => e.trackId === trackId)

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
      const removeIds = new Set(sorted.slice(0, toRemove).map((e) => e.trackId))
      entries.value = entries.value.filter((e) => !removeIds.has(e.trackId))
    }
  }

  function clear(): void {
    entries.value = []
    void historyPersistenceService.clear()
  }

  function getEntry(trackId: string): PlayHistoryEntry | null {
    return entries.value.find((e) => e.trackId === trackId) ?? null
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
