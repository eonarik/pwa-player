// src/composables/useMetadataSearch.ts

import { computed, ref, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { trackMetadataService } from '@/services/metadata/TrackMetadataService'
import { metadataService } from '@/services/metadata/MetadataService'
import { useUiSettingsStore } from '@/stores/uiSettings'
import type { LibraryTrack } from '@/types/library'
import type { MetadataCandidate } from '@/services/metadata/TrackMetadataService'
import { UNKNOWN_ARTIST_PLACEHOLDER } from '@/services/metadata/constants'
import { guessMetadataFromFilename } from '@/utils/parseFilename'

const CONCURRENCY = 3
const FLUSH_INTERVAL = 10

export interface MetadataIssue {
  track: LibraryTrack
  candidates: MetadataCandidate[]
}

export function useMetadataSearch(tracks: Ref<LibraryTrack[]>) {
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
      const guessed = guessMetadataFromFilename(t.filename || '')
      const hasArtistPattern = Boolean(guessed.artist && guessed.title)

      if (!hasArtistPattern) return false

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
    return tracksNeedingMetadata.value.filter((t) => !metadataService.hasEntry(t.id))
  })

  const stats = computed(() => {
    void version.value
    let found = 0
    let checked = 0
    for (const t of tracks.value) {
      const entry = metadataService.getEntry(t.id)
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
            metadataService.markNotFound(track.id)
            progress.value = { done: progress.value.done + 1, total: toFetch.length }
            bumpVersion()

            sinceLastFlush++
            if (sinceLastFlush >= FLUSH_INTERVAL) {
              sinceLastFlush = 0
              await metadataService.flush()
            }
            continue
          }

          const applyResult = metadataService.applyRemote(track.id, result.data)

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
            await metadataService.flush()
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, toFetch.length) }, () => worker()),
      )

      await metadataService.flush()
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

    await metadataService.resetMany(ids)

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
