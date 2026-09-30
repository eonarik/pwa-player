// src/composables/useCoverSearch.ts

import { computed, ref, type Ref } from 'vue'
import { coverService } from '@/services/covers/CoverService'
import { coverPersistenceService } from '@/services/persistence/CoverPersistenceService'
import { useLibraryStore } from '@/stores/library'
import type { LibraryTrack } from '@/types/library'

/** Сколько обложек ищем параллельно */
const COVER_CONCURRENCY = 3
/** Через сколько найденных обложек сбрасываем батч в IDB */
const FLUSH_INTERVAL = 10

export function useCoverSearch(tracks: Ref<LibraryTrack[]>) {
  const library = useLibraryStore()

  const isLoading = ref(false)
  const progress = ref({ done: 0, total: 0 })
  const abortController = ref<AbortController | null>(null)

  const tracksWithoutCover = computed(() => tracks.value.filter((t) => !t.coverUrl))

  const uncheckedTracks = computed(() =>
    tracksWithoutCover.value.filter((t) => coverPersistenceService.get(t.id) === undefined),
  )

  const stats = computed(() => {
    const total = tracks.value.length
    const found = tracks.value.filter((t) => t.coverUrl).length
    return { found, total }
  })

  const hasUnchecked = computed(() => uncheckedTracks.value.length > 0)

  async function search(): Promise<void> {
    if (isLoading.value) return
    const toFetch = uncheckedTracks.value
    if (toFetch.length === 0) return

    isLoading.value = true
    progress.value = { done: 0, total: toFetch.length }
    abortController.value = new AbortController()
    const signal = abortController.value.signal

    let sinceLastFlush = 0
    let cursor = 0

    try {
      const worker = async (): Promise<void> => {
        while (cursor < toFetch.length) {
          if (signal.aborted) return
          const track = toFetch[cursor++]!

          const coverUrl = await coverService.fetch(track.artist, track.title, signal)

          if (signal.aborted) return

          coverPersistenceService.setInMemory(track.id, coverUrl)

          if (coverUrl) {
            const existing = library.getTrack(track.id)
            if (existing) existing.coverUrl = coverUrl
          }

          progress.value = { done: progress.value.done + 1, total: toFetch.length }

          sinceLastFlush++
          if (sinceLastFlush >= FLUSH_INTERVAL) {
            sinceLastFlush = 0
            await coverPersistenceService.flush()
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(COVER_CONCURRENCY, toFetch.length) }, () => worker()),
      )

      await coverPersistenceService.flush()
      library.bumpCoversVersion()
    } finally {
      isLoading.value = false
      progress.value = { done: 0, total: 0 }
      abortController.value = null
    }
  }

  function cancel(): void {
    abortController.value?.abort()
  }

  async function reset(): Promise<void> {
    // Сбрасываем только те треки, для которых есть запись в кэше обложек
    // (обложки из тегов и folder.jpg в кэше не лежат — их не трогаем)
    const known = tracks.value.filter((t) => coverPersistenceService.get(t.id) !== undefined)
    if (known.length === 0) return

    const ids = known.map((t) => t.id)

    await coverPersistenceService.resetForTracks(ids)

    for (const id of ids) {
      const track = library.getTrack(id)
      if (!track) continue
      // Не сбрасываем blob — это обложка из тегов/folder.jpg
      if (track.coverUrl && !track.coverUrl.startsWith('blob:')) {
        track.coverUrl = undefined
      }
    }

    library.bumpCoversVersion()
  }

  return {
    isLoading,
    progress,
    tracksWithoutCover,
    uncheckedTracks,
    stats,
    hasUnchecked,
    search,
    cancel,
    reset,
  }
}
