// src/services/metadata/MetadataService.ts

import {
  metadataPersistenceService,
  type OriginalMetadata,
} from '@/services/persistence/MetadataPersistenceService'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { UNKNOWN_ARTIST_PLACEHOLDER } from './constants'
import type { LibraryTrack } from '@/types/library'
import type { MetadataCandidate, RemoteTrackMetadata } from './TrackMetadataService'

export type ApplyResult =
  | { status: 'applied' }
  | { status: 'issue'; candidates: MetadataCandidate[] }
  | { status: 'skipped' }

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

  // --- Публичные методы ---------------------------------------------

  /**
   * Применить найденные метаданные (iTunes/Deezer).
   * Если similarity ниже порога — возвращает `issue` с кандидатами,
   * ничего не применяя.
   */
  applyRemote(trackId: string, incoming: RemoteTrackMetadata): ApplyResult {
    const track = useLibraryStore().getTrack(trackId)
    if (!track) return { status: 'skipped' }

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

  /**
   * Применить конкретного кандидата (из MetadataIssuesModal).
   */
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

    this.applyPatch(track, candidate)
    this.scheduleFlush()
  }

  /**
   * Ручное редактирование (TrackMetadataModal).
   */
  updateManual(trackId: string, patch: ManualPatch): void {
    const track = useLibraryStore().getTrack(trackId)
    if (!track) return

    const library = useLibraryStore()
    library.updateTrackMetadata(trackId, {
      artist: patch.artist,
      title: patch.title,
      album: patch.album,
      coverUrl: patch.coverUrl,
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

  /**
   * Сброс одного трека к оригиналу.
   */
  async reset(trackId: string): Promise<void> {
    const library = useLibraryStore()
    const track = library.getTrack(trackId)
    if (!track) return

    const entry = metadataPersistenceService.get(trackId)
    if (!entry?.original) {
      await metadataPersistenceService.resetForTracks([trackId])
      return
    }

    library.updateTrackMetadata(trackId, {
      artist: entry.original.artist,
      title: entry.original.title,
      album: entry.original.album,
      coverUrl: entry.original.coverUrl,
    })

    this.syncQueue(trackId)

    await metadataPersistenceService.resetForTracks([trackId])
  }

  /**
   * Сброс множества треков к оригиналу (useMetadataSearch.reset).
   */
  async resetMany(trackIds: string[]): Promise<void> {
    const library = useLibraryStore()

    for (const trackId of trackIds) {
      const track = library.getTrack(trackId)
      if (!track) continue

      const entry = metadataPersistenceService.get(trackId)
      if (!entry?.original) continue

      library.updateTrackMetadata(trackId, {
        artist: entry.original.artist,
        title: entry.original.title,
        album: entry.original.album,
        coverUrl: entry.original.coverUrl,
      })

      this.syncQueue(trackId)
    }

    await metadataPersistenceService.resetForTracks(trackIds)
  }

  /**
   * Пометить трек как «не найдено» (кэш с TTL 7 дней).
   */
  markNotFound(trackId: string): void {
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

  // --- Прокси для UI (useMetadataSearch) ---------------------------

  hasEntry(trackId: string): boolean {
    return metadataPersistenceService.has(trackId)
  }

  getEntry(trackId: string) {
    return metadataPersistenceService.get(trackId)
  }

  // --- Flush -------------------------------------------------------

  /**
   * Немедленно сохранить кэш в IDB (beforeunload / visibilitychange).
   */
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

  // --- Внутренние хелперы ------------------------------------------

  private applyPatch(
    track: LibraryTrack,
    incoming: { artist: string; title: string; album: string; coverUrl: string | null },
  ): void {
    const patch: Partial<Pick<LibraryTrack, 'artist' | 'title' | 'album' | 'coverUrl'>> = {}

    const artist = track.artist?.trim() ?? ''

    if (!artist || artist === UNKNOWN_ARTIST_PLACEHOLDER) {
      if (incoming.artist) patch.artist = incoming.artist
    }
    if (incoming.title) patch.title = incoming.title
    if (incoming.album) patch.album = incoming.album
    if (!track.coverUrl && incoming.coverUrl) patch.coverUrl = incoming.coverUrl

    if (Object.keys(patch).length === 0) return

    useLibraryStore().updateTrackMetadata(track.id, patch)
    this.syncQueue(track.id)
  }

  /**
   * Синхронизировать queue в player (единственное место вызова
   * player.updateTrackInQueue — кроме playerRestore).
   */
  private syncQueue(trackId: string): void {
    try {
      usePlayerStore().updateTrackInQueue(trackId)
    } catch {
      // Pinia может быть не инициализирована (тесты)
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
    // Сохраняем только http(s) URL. Blob URL невалиден после F5,
    // поэтому при откате он становится `undefined`.
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
