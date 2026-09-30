// src/composables/useMetadataSearch.ts

import { computed, ref, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  trackMetadataService,
  type MetadataCandidate,
} from '@/services/metadata/TrackMetadataService'
import {
  metadataPersistenceService,
  type OriginalMetadata,
} from '@/services/persistence/MetadataPersistenceService'
import { useLibraryStore } from '@/stores/library'
import { useUiSettingsStore } from '@/stores/uiSettings'
import type { LibraryTrack } from '@/types/library'

const CONCURRENCY = 3
const FLUSH_INTERVAL = 10
const UNKNOWN_ARTIST_PLACEHOLDER = 'Yandex Disk'

export interface MetadataIssue {
  track: LibraryTrack
  candidates: MetadataCandidate[]
}

function buildOriginal(track: LibraryTrack): OriginalMetadata {
  const coverUrl = track.coverUrl
  const isBlob = coverUrl?.startsWith('blob:') ?? false
  return {
    artist: track.artist ?? '',
    title: track.title,
    album: track.album ?? '',
    coverUrl,
    coverUrlWasBlob: isBlob,
  }
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

          const incoming = await trackMetadataService.fetch(
            track.artist ?? '',
            track.title,
            threshold,
            signal,
          )

          if (signal.aborted) return

          if (!incoming) {
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

          metadataPersistenceService.setInMemory(track.id, {
            artist: incoming.artist,
            title: incoming.title,
            album: incoming.album,
            coverUrl: incoming.coverUrl,
            similarity: incoming.similarity,
            original: buildOriginal(track),
          })

          if (incoming.confident) {
            applyMetadata(track, incoming)
          } else {
            foundIssues.push({
              track,
              candidates: incoming.candidates ?? [
                {
                  artist: incoming.artist,
                  title: incoming.title,
                  album: incoming.album,
                  coverUrl: incoming.coverUrl,
                  source: incoming.source,
                  similarity: incoming.similarity,
                },
              ],
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

  function applyMetadata(
    track: LibraryTrack,
    incoming: { artist: string; title: string; album: string; coverUrl: string | null },
  ): void {
    const patch: Partial<Pick<LibraryTrack, 'artist' | 'title' | 'album' | 'coverUrl'>> = {}

    const artist = track.artist?.trim() ?? ''

    if (!artist || artist === UNKNOWN_ARTIST_PLACEHOLDER) {
      if (incoming.artist) patch.artist = incoming.artist
    }
    if (incoming.title) {
      patch.title = incoming.title
    }
    if (incoming.album) {
      patch.album = incoming.album
    }
    if (!track.coverUrl && incoming.coverUrl) {
      patch.coverUrl = incoming.coverUrl
    }

    if (Object.keys(patch).length > 0) {
      library.updateTrackMetadata(track.id, patch)
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
