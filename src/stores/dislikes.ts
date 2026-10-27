// src/stores/dislikes.ts

import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { dislikesPersistenceService } from '@/services/persistence/DislikesPersistenceService'
import { createTrackSnapshot } from '@/utils/trackSnapshot'
import type { DislikeEntry } from '@/types/dislike'
import type { Track } from '@/types/track'

export const useDislikesStore = defineStore('dislikes', () => {
  // --- Состояние ------------------------------------------------------

  const entries = ref<DislikeEntry[]>([])

  const isRestoring = ref(false)

  // --- Computed -------------------------------------------------------

  const dislikedIds = computed<Set<string>>(() => {
    // ИСПОЛЬЗУЕМ id вместо trackId
    return new Set(entries.value.map((e) => e.id))
  })

  const sortedEntries = computed<DislikeEntry[]>(() => {
    return [...entries.value].sort((a, b) => b.dislikedAt - a.dislikedAt)
  })

  // --- Восстановление и сохранение ------------------------------------

  async function restore(): Promise<boolean> {
    isRestoring.value = true
    try {
      const loaded = await dislikesPersistenceService.load()
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
    const plain = entries.value.map((e) => JSON.parse(JSON.stringify(e))) as DislikeEntry[]
    dislikesPersistenceService.save(plain)
  }

  watch(
    entries,
    () => {
      save()
    },
    { deep: true },
  )

  async function flush(): Promise<void> {
    await dislikesPersistenceService.flush()
  }

  // --- Внутренние хелперы ---------------------------------------------

  function toEntry(track: Track): DislikeEntry {
    return {
      ...createTrackSnapshot(track),
      dislikedAt: Date.now(),
    }
  }

  // --- Действия -------------------------------------------------------

  function isDisliked(trackId: string): boolean {
    return dislikedIds.value.has(trackId)
  }

  function dislike(track: Track): void {
    if (isDisliked(track.id)) return
    entries.value.push(toEntry(track))
  }

  function undislike(trackId: string): void {
    // ИСПОЛЬЗУЕМ id вместо trackId
    entries.value = entries.value.filter((e) => e.id !== trackId)
  }

  function toggleDislike(track: Track): boolean {
    if (isDisliked(track.id)) {
      undislike(track.id)
      return false
    } else {
      dislike(track)
      return true
    }
  }

  function clear(): void {
    entries.value = []
    void dislikesPersistenceService.clear()
  }

  return {
    entries,
    isRestoring,

    dislikedIds,
    sortedEntries,

    restore,
    save,
    isDisliked,
    dislike,
    undislike,
    toggleDislike,
    clear,
    flush,
  }
})
