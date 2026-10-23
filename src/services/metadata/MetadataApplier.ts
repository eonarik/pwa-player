// src/services/metadata/MetadataApplier.ts

import {
  metadataPersistenceService,
  type OriginalMetadata,
} from '@/services/persistence/MetadataPersistenceService'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import type { LibraryTrack } from '@/types/library'
import type { MetadataCandidate, RemoteTrackMetadata } from './TrackMetadataService'
import { UNKNOWN_ARTIST_PLACEHOLDER } from './constants'

export type ApplyResult =
  | { status: 'applied' }
  | { status: 'issue'; candidates: MetadataCandidate[] }
  | { status: 'skipped' }

class MetadataApplier {
  private static instance: MetadataApplier | null = null

  static getInstance(): MetadataApplier {
    if (!MetadataApplier.instance) {
      MetadataApplier.instance = new MetadataApplier()
    }
    return MetadataApplier.instance
  }

  apply(track: LibraryTrack, incoming: RemoteTrackMetadata): ApplyResult {
    this.saveToCache(track, incoming)

    if (incoming.confident) {
      this.applyPatch(track, incoming)
      return { status: 'applied' }
    }

    const candidates =
      incoming.candidates && incoming.candidates.length > 0
        ? incoming.candidates
        : [
            {
              artist: incoming.artist,
              title: incoming.title,
              album: incoming.album,
              coverUrl: incoming.coverUrl,
              source: incoming.source,
              similarity: incoming.similarity,
            },
          ]

    return { status: 'issue', candidates }
  }

  applyCandidate(track: LibraryTrack, candidate: MetadataCandidate): void {
    metadataPersistenceService.setInMemory(track.id, {
      artist: candidate.artist,
      title: candidate.title,
      album: candidate.album,
      coverUrl: candidate.coverUrl,
      similarity: candidate.similarity,
      original: this.buildOriginal(track),
    })

    this.applyPatch(track, candidate)
    void metadataPersistenceService.flush()
  }

  private saveToCache(track: LibraryTrack, incoming: RemoteTrackMetadata): void {
    metadataPersistenceService.setInMemory(track.id, {
      artist: incoming.artist,
      title: incoming.title,
      album: incoming.album,
      coverUrl: incoming.coverUrl,
      similarity: incoming.similarity,
      original: this.buildOriginal(track),
    })
  }

  private applyPatch(
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

    if (Object.keys(patch).length === 0) return

    const library = useLibraryStore()
    library.updateTrackMetadata(track.id, patch)

    // Синхронизируем очередь, если этот трек в ней есть
    try {
      const player = usePlayerStore()
      player.updateTrackInQueue(track.id)
    } catch {
      // Pinia может быть не инициализирована (например, в тестах)
    }
  }

  buildOriginal(track: LibraryTrack): OriginalMetadata {
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
}

export const metadataApplier = MetadataApplier.getInstance()
