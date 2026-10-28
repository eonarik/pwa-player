// src/stores/library/resolveTrack.ts

import type { Ref } from 'vue'
import type { LibraryTrack, Album } from '@/types/library'
import type { Track, TrackSource } from '@/types/track'
import { buildEntitiesForTrack } from '@/services/library/EntityGraph'
import { findBestMatch } from '@/services/playlists/PlaylistMatcher'
import { getPluginManifest } from '@/plugins/lookup'
import { useUiSettingsStore } from '@/stores/uiSettings'

export interface ResolveTrackDeps {
  tracks: Ref<Record<string, LibraryTrack>>
  albums: Ref<Record<string, Album>>
  virtualTracks: Ref<Record<string, LibraryTrack>>
}

export function createResolveTrack(deps: ResolveTrackDeps) {
  const { tracks, albums, virtualTracks } = deps

  function resolveOrCreateTrack(incoming: Track): string {
    if (tracks.value[incoming.id] && !incoming.isVirtual) {
      return incoming.id
    }

    const uiSettings = useUiSettingsStore()
    const threshold = uiSettings.playlistMatchThreshold

    const candidates = Object.values(tracks.value).filter((t) => !t.isVirtual)
    const { track: match, score } = findBestMatch(incoming, candidates, threshold)

    const manifest = getPluginManifest(incoming.pluginId)
    const priority = manifest?.sourcePriority ?? 999

    const newSource: TrackSource = {
      id: incoming.id,
      pluginId: incoming.pluginId,
      url: incoming.sources?.[0]?.url,
      priority,
    }

    // Если нашли совпадение выше порога
    if (match && score >= threshold) {
      const existing = tracks.value[match.id]!

      const artistStrict =
        (existing.artist || '').toLowerCase().trim() ===
        (incoming.artist || '').toLowerCase().trim()
      const titleStrict =
        (existing.title || '').toLowerCase().trim() === (incoming.title || '').toLowerCase().trim()
      const isStrictMatch = artistStrict && titleStrict

      if (isStrictMatch) {
        // --- Строгий мэтч ---
        if (!existing.album && incoming.album) existing.album = incoming.album
        if (!existing.artist && incoming.artist) existing.artist = incoming.artist

        const incomingCover = incoming.coverUrl || incoming.raw?.coverUrl

        if (!existing.albumId && existing.album) {
          const { track: updatedTrack, album: newAlbum } = buildEntitiesForTrack(existing)
          existing.albumId = updatedTrack.albumId

          if (newAlbum) {
            const existingAlbum = albums.value[newAlbum.id]
            if (existingAlbum) {
              if (!existingAlbum.trackIds.includes(existing.id))
                existingAlbum.trackIds.push(existing.id)
              if (!existingAlbum.coverUrl && incomingCover) existingAlbum.coverUrl = incomingCover
            } else {
              newAlbum.coverUrl = incomingCover
              albums.value[newAlbum.id] = newAlbum
            }
          }
        }

        const hasSource = existing.sources.some((s) => s.id === newSource.id)
        if (!hasSource) {
          existing.sources.push(newSource)
          existing.sources.sort((a, b) => a.priority - b.priority)
        }

        if (existing.albumId) {
          const album = albums.value[existing.albumId]
          if (album && !album.coverUrl && incomingCover) album.coverUrl = incomingCover
        }
      } else {
        // --- Нестрогий мэтч (fuzzy) ---
        if (!existing.alternateSources) existing.alternateSources = []
        const hasAlt = existing.alternateSources.some((s) => s.id === newSource.id)
        if (!hasAlt) {
          existing.alternateSources.push(newSource)
        }
      }

      return existing.id
    }

    // --- Нет мэтча (score < threshold) — создаем новый трек ---
    const virtualId = incoming.id
    const next: LibraryTrack = {
      ...incoming,
      id: virtualId,
      folderId: 'virtual',
      isVirtual: true,
      sources: [newSource],
    }

    const { track: trackWithAlbum, album } = buildEntitiesForTrack(next)

    if (album) {
      const existingAlbum = albums.value[album.id]
      if (existingAlbum) {
        if (!existingAlbum.trackIds.includes(trackWithAlbum.id))
          existingAlbum.trackIds.push(trackWithAlbum.id)
        if (!existingAlbum.coverUrl && album.coverUrl) existingAlbum.coverUrl = album.coverUrl
      } else {
        albums.value[album.id] = album
      }
    }

    virtualTracks.value[trackWithAlbum.id] = trackWithAlbum
    tracks.value[trackWithAlbum.id] = trackWithAlbum

    return trackWithAlbum.id
  }

  return { resolveOrCreateTrack }
}
