// src/composables/useMetadataSearch.ts

import { computed, ref, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { trackMetadataService } from '@/services/metadata/TrackMetadataService'
import { metadataApplier } from '@/services/metadata/MetadataApplier'
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { useLibraryStore } from '@/stores/library'
import type { LibraryTrack } from '@/types/library'
import type { MetadataCandidate } from '@/services/metadata/TrackMetadataService'

const CONCURRENCY = 3
const FLUSH_INTERVAL = 10
const UNKNOWN_ARTIST_PLACEHOLDER = 'Yandex Disk'

export interface MetadataIssue {
  track: LibraryTrack
  candidates: MetadataCandidate[]
}

export function useMetadataSearch(tracks: Ref<LibraryTrack[]>) {
  const library = useLibraryStore()
  const uiSettings = useUiSettingsStore()
  const { metadataThreshold } = storeToRefs(uiSettings)

  const isLoading = ref(false)
  const progress = ref({ done: 0, total: 0 })
  const abortController = ref<AbortController | null>(null)

  const version = ref(0)

  function bumpVersion(): void {
    version.value++
  }

  const tracksNeedingMetadata = computed(() =>
    tracks.value.filter((t) => {
      const artist = t.artist?.trim() ?? ''
      const album = t.album?.trim() ?? ''
      const hasArtist = artist && artist !== UNKNOWN_ARTIST_PLACEHOLDER
      const hasAlbum = album && album !== UNKNOWN_ARTIST_PLACEHOLDER
      const hasCover = Boolean(t.coverUrl)
      return !hasArtist || !hasAlbum || !hasCover
    }),
  )

  const uncheckedTracks = computed(() => {
    void version.value
    return tracksNeedingMetadata.value.filter((t) => !metadataPersistenceService.has(t.id))
  })

  const stats = computed(() => {
    void version.value
    let found = 0
    let checked = 0
    for (const t of tracks.value) {
      const entry = metadataPersistenceService.get(t.id)
      if (entry !== undefined) checked++
      const artist = t.artist?.trim() ?? ''
      const album = t.album?.trim() ?? ''
      if (
        artist &&
        artist !== UNKNOWN_ARTIST_PLACEHOLDER &&
        album &&
        album !== UNKNOWN_ARTIST_PLACEHOLDER &&
        t.coverUrl
      ) {
        found++
      }
    }
    return { found, checked, total: tracks.value.length }
  })

  const hasUnchecked = computed(() => uncheckedTracks.value.length > 0)

  const issues = ref<MetadataIssue[]>([])

  async function search(): Promise<void> {
    if (isLoading.value) return
    const toFetch = uncheckedTracks.value
    if (toFetch.length === 0) return

    isLoading.value = true
    progress.value = { done: 0, total: toFetch.length }
    abortController.value = new AbortController()
    const signal = abortController.value.signal

    const threshold = metadataThreshold.value

    const foundIssues: MetadataIssue[] = []
    let sinceLastFlush = 0
    let cursor = 0

    try {
      const worker = async (): Promise<void> => {
        while (cursor < toFetch.length) {
          if (signal.aborted) return
          const track = toFetch[cursor++]!

          const result = await trackMetadataService.fetch(
            track.artist ?? '',
            track.title,
            threshold,
            signal,
          )

          if (signal.aborted) return

          if (result.status === 'aborted') {
            return
          }

          if (result.status === 'error') {
            progress.value = { done: progress.value.done + 1, total: toFetch.length }
            continue
          }

          if (result.status === 'not-found') {
            metadataPersistenceService.setInMemory(track.id, {
              artist: null,
              title: null,
              album: null,
              coverUrl: null,
              similarity: null,
              original: null,
            })
            progress.value = { done: progress.value.done + 1, total: toFetch.length }
            bumpVersion()

            sinceLastFlush++
            if (sinceLastFlush >= FLUSH_INTERVAL) {
              sinceLastFlush = 0
              await metadataPersistenceService.flush()
            }
            continue
          }

          // Found — общий сервис решает, применить или в issues
          const applyResult = metadataApplier.apply(track, result.data)

          if (applyResult.status === 'issue') {
            foundIssues.push({
              track,
              candidates: applyResult.candidates,
            })
          }

          progress.value = { done: progress.value.done + 1, total: toFetch.length }
          bumpVersion()

          sinceLastFlush++
          if (sinceLastFlush >= FLUSH_INTERVAL) {
            sinceLastFlush = 0
            await metadataPersistenceService.flush()
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, toFetch.length) }, () => worker()),
      )

      await metadataPersistenceService.flush()
      issues.value = foundIssues
      bumpVersion()
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
    const ids = tracks.value.map((t) => t.id)
    if (ids.length === 0) return

    for (const id of ids) {
      const entry = metadataPersistenceService.get(id)
      if (!entry?.original) continue

      const track = library.getTrack(id)
      if (!track) continue

      const patch: Partial<Pick<LibraryTrack, 'artist' | 'title' | 'album' | 'coverUrl'>> = {
        artist: entry.original.artist,
        title: entry.original.title,
        album: entry.original.album,
      }

      if (!entry.original.coverUrlWasBlob) {
        patch.coverUrl = entry.original.coverUrl
      }

      library.updateTrackMetadata(id, patch)
    }

    await metadataPersistenceService.resetForTracks(ids)

    issues.value = []
    bumpVersion()
  }

  function dismissIssues(): void {
    issues.value = []
  }

  return {
    isLoading,
    progress,
    tracksNeedingMetadata,
    uncheckedTracks,
    stats,
    hasUnchecked,
    issues,
    search,
    cancel,
    reset,
    dismissIssues,
  }
}
