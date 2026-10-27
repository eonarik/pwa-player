// src/stores/dislikes.ts

import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { dislikesPersistenceService } from '@/services/persistence/DislikesPersistenceService'
import { useLibraryStore } from './library'
import type { DislikeEntry } from '@/types/dislike'
import type { Track } from '@/types/track'

export const useDislikesStore = defineStore('dislikes', () => {
  const entries = ref<DislikeEntry[]>([])
  const isRestoring = ref(false)

  const dislikedIds = computed<Set<string>>(() => {
    return new Set(entries.value.map((e) => e.trackId))
  })

  const sortedEntries = computed<DislikeEntry[]>(() => {
    return [...entries.value].sort((a, b) => b.dislikedAt - a.dislikedAt)
  })

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

  function isDisliked(trackId: string): boolean {
    return dislikedIds.value.has(trackId)
  }

  async function dislike(track: Track): Promise<void> {
    const library = useLibraryStore()
    const resolvedId = await library.resolveOrCreateTrack(track)

    if (isDisliked(resolvedId)) return
    entries.value.push({ trackId: resolvedId, dislikedAt: Date.now() })
  }

  function undislike(trackId: string): void {
    entries.value = entries.value.filter((e) => e.trackId !== trackId)
  }

  async function toggleDislike(track: Track): Promise<boolean> {
    const library = useLibraryStore()
    const resolvedId = await library.resolveOrCreateTrack(track)

    if (isDisliked(resolvedId)) {
      undislike(resolvedId)
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
