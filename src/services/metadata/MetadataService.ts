// src/services/metadata/MetadataService.ts

import {
  metadataPersistenceService,
  type OriginalMetadata,
} from '@/services/persistence/MetadataPersistenceService'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { UNKNOWN_ARTIST_PLACEHOLDER } from './constants'
import type { LibraryTrack, MetadataSource } from '@/types/library'
import type { TrackMetadata } from './types'
import type { MetadataCandidate, RemoteTrackMetadata } from './TrackMetadataService'

export type ApplyResult =
  | { status: 'applied' }
  | { status: 'issue'; candidates: MetadataCandidate[] }
  | { status: 'skipped'; reason: 'protected' | 'not-found' }

export interface ManualPatch {
  artist: string
  title: string
  album: string
  coverUrl: string | undefined
}

const FLUSH_DEBOUNCE_MS = 500

class MetadataService {
  private static instance: MetadataService | null = null

  private flushTimer: ReturnType<typeof setTimeout> | null = null

  static getInstance(): MetadataService {
    if (!MetadataService.instance) {
      MetadataService.instance = new MetadataService()
    }
    return MetadataService.instance
  }

  applyRemote(trackId: string, incoming: RemoteTrackMetadata): ApplyResult {
    const track = useLibraryStore().getTrack(trackId)
    if (!track) return { status: 'skipped', reason: 'not-found' }

    // Защита от перезаписи ручных правок и честных тегов файла
    if (track.metaSource === 'manual' || track.hasId3Tags) {
      return { status: 'skipped', reason: 'protected' }
    }

    this.saveToCache(track, incoming)

    if (incoming.confident) {
      this.applyPatch(track, incoming, 'auto')
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

  applyCandidate(trackId: string, candidate: MetadataCandidate): void {
    const track = useLibraryStore().getTrack(trackId)
    if (!track) return

    metadataPersistenceService.setInMemory(trackId, {
      artist: candidate.artist,
      title: candidate.title,
      album: candidate.album,
      coverUrl: candidate.coverUrl,
      similarity: candidate.similarity,
      original: this.buildOriginal(track),
    })

    this.applyPatch(track, candidate, 'manual')
    this.scheduleFlush()
  }

  updateManual(trackId: string, patch: ManualPatch): void {
    const track = useLibraryStore().getTrack(trackId)
    if (!track) return

    const library = useLibraryStore()
    library.updateTrackMetadata(trackId, {
      artist: patch.artist,
      title: patch.title,
      album: patch.album,
      coverUrl: patch.coverUrl,
      metaSource: 'manual',
    })

    this.syncQueue(trackId)

    metadataPersistenceService.setInMemory(trackId, {
      artist: patch.artist || null,
      title: patch.title,
      album: patch.album || null,
      coverUrl: patch.coverUrl ?? null,
      similarity: 1,
      original: this.buildOriginal(track),
    })

    this.scheduleFlush()
  }

  applyFromFile(trackId: string, parsed: TrackMetadata): void {
    const track = useLibraryStore().getTrack(trackId)
    if (!track) return

    if (track.metaSource === 'manual') return

    const patch: Partial<LibraryTrack> = {
      metaSource: 'file',
      hasId3Tags: true,
    }

    if (parsed.title) patch.title = parsed.title
    if (parsed.artist) patch.artist = parsed.artist
    if (parsed.album) patch.album = parsed.album
    if (parsed.coverUrl) patch.coverUrl = parsed.coverUrl
    if (parsed.duration) patch.duration = parsed.duration

    useLibraryStore().updateTrackMetadata(trackId, patch)
    this.syncQueue(trackId)
  }

  async reset(trackId: string): Promise<void> {
    const library = useLibraryStore()
    const track = library.getTrack(trackId)
    if (!track) return

    const raw = track.raw

    if (raw) {
      library.updateTrackMetadata(trackId, {
        artist: raw.artist,
        title: raw.title,
        album: raw.album,
        coverUrl: raw.coverUrl,
        metaSource: 'filename',
        hasId3Tags: raw.hasId3Tags ?? false,
      })
    } else {
      const entry = metadataPersistenceService.get(trackId)
      library.updateTrackMetadata(trackId, {
        artist: entry?.original?.artist ?? '',
        title: entry?.original?.title ?? track.title,
        album: entry?.original?.album ?? '',
        coverUrl: entry?.original?.coverUrl ?? undefined,
        metaSource: 'filename',
        hasId3Tags: false,
      })
    }

    this.syncQueue(trackId)
    await this.markNotFoundAndFlush(trackId)
  }

  async resetMany(trackIds: string[]): Promise<void> {
    const library = useLibraryStore()

    for (const trackId of trackIds) {
      const track = library.getTrack(trackId)
      if (!track) continue

      const raw = track.raw

      if (raw) {
        library.updateTrackMetadata(trackId, {
          artist: raw.artist,
          title: raw.title,
          album: raw.album,
          coverUrl: raw.coverUrl,
          metaSource: 'filename',
          hasId3Tags: raw.hasId3Tags ?? false,
        })
      } else {
        const entry = metadataPersistenceService.get(trackId)
        library.updateTrackMetadata(trackId, {
          artist: entry?.original?.artist ?? '',
          title: entry?.original?.title ?? track.title,
          album: entry?.original?.album ?? '',
          coverUrl: entry?.original?.coverUrl ?? undefined,
          metaSource: 'filename',
          hasId3Tags: false,
        })
      }

      this.syncQueue(trackId)
      this.markNotFound(trackId)
    }

    await this.flush()
  }

  markNotFound(trackId: string): void {
    const track = useLibraryStore().getTrack(trackId)
    if (track?.metaSource === 'manual' || track?.hasId3Tags) return

    metadataPersistenceService.setInMemory(trackId, {
      artist: null,
      title: null,
      album: null,
      coverUrl: null,
      similarity: null,
      original: null,
    })
    this.scheduleFlush()
  }

  private async markNotFoundAndFlush(trackId: string): Promise<void> {
    this.markNotFound(trackId)
    await this.flush()
  }

  hasEntry(trackId: string): boolean {
    return metadataPersistenceService.has(trackId)
  }

  getEntry(trackId: string) {
    return metadataPersistenceService.get(trackId)
  }

  async flush(): Promise<void> {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    await metadataPersistenceService.flush()
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void metadataPersistenceService.flush()
    }, FLUSH_DEBOUNCE_MS)
  }

  private applyPatch(
    track: LibraryTrack,
    incoming: { artist: string; title: string; album: string; coverUrl: string | null },
    source: MetadataSource,
  ): void {
    const patch: Partial<
      Pick<LibraryTrack, 'artist' | 'title' | 'album' | 'coverUrl' | 'metaSource'>
    > = {
      metaSource: source,
    }

    const artist = track.artist?.trim() ?? ''

    if (!artist || artist === UNKNOWN_ARTIST_PLACEHOLDER) {
      if (incoming.artist) patch.artist = incoming.artist
    }
    if (incoming.title) patch.title = incoming.title
    if (incoming.album) patch.album = incoming.album
    if (!track.coverUrl && incoming.coverUrl) patch.coverUrl = incoming.coverUrl

    useLibraryStore().updateTrackMetadata(track.id, patch)
    this.syncQueue(track.id)
  }

  private syncQueue(trackId: string): void {
    try {
      usePlayerStore().updateTrackInQueue(trackId)
    } catch {
      // ignore
    }
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

  private buildOriginal(track: LibraryTrack): OriginalMetadata {
    const coverUrl = track.coverUrl
    const safeCoverUrl = coverUrl?.startsWith('http') ? coverUrl : undefined

    return {
      artist: track.artist ?? '',
      title: track.title,
      album: track.album ?? '',
      coverUrl: safeCoverUrl,
    }
  }
}

export const metadataService = MetadataService.getInstance()
