// src/stores/history.ts

import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { historyPersistenceService } from '@/services/persistence/HistoryPersistenceService'
import { HISTORY_MAX_SIZE } from '@/types/history'
import { useLibraryStore } from './library'
import type { PlayHistoryEntry } from '@/types/history'
import type { Track } from '@/types/track'

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<PlayHistoryEntry[]>([])
  const isRestoring = ref(false)

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

  async function recordPlay(track: Track): Promise<void> {
    const library = useLibraryStore()
    const resolvedId = await library.resolveOrCreateTrack(track)

    const index = entries.value.findIndex((e) => e.trackId === resolvedId)

    if (index !== -1) {
      entries.value[index] = {
        ...entries.value[index]!,
        playedAt: Date.now(),
      }
    } else {
      entries.value.push({ trackId: resolvedId, playedAt: Date.now() })
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
