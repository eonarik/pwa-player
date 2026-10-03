// src/services/metadata/MetadataApplier.ts

import {
  metadataPersistenceService,
  type OriginalMetadata,
} from '@/services/persistence/MetadataPersistenceService'
import { useLibraryStore } from '@/stores/library'
import type { LibraryTrack } from '@/types/library'
import type { MetadataCandidate, RemoteTrackMetadata } from './TrackMetadataService'
import { UNKNOWN_ARTIST_PLACEHOLDER } from './constants'

export type ApplyResult =
  | { status: 'applied' }
  | { status: 'issue'; candidates: MetadataCandidate[] }
  | { status: 'skipped' }

/**
 * Единый сервис применения найденных метаданных.
 *
 * Используется из:
 * - TrackActions (одиночный поиск)
 * - useMetadataSearch (массовый поиск)
 * - MetadataIssuesModal (ручное применение выбранного кандидата)
 */
class MetadataApplier {
  private static instance: MetadataApplier | null = null

  static getInstance(): MetadataApplier {
    if (!MetadataApplier.instance) {
      MetadataApplier.instance = new MetadataApplier()
    }
    return MetadataApplier.instance
  }

  /**
   * Применяет результат поиска метаданных.
   *
   * - Сохраняет запись в кэш (с original snapshot).
   * - Если confident → применяет патч к library.
   * - Если !confident → возвращает candidates для issues.
   * - Если incoming пустой → skipped.
   */
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

  /**
   * Применяет конкретного кандидата (из MetadataIssuesModal).
   * Не проверяет порог — пользователь сам выбрал.
   * Сохраняет в кэш как confident-результат.
   */
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

  // --- Внутренние -------------------------------------------------------

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

  /**
   * Правило X:
   * - artist — только если был пуст / плейсхолдер.
   * - title — всегда, если incoming.title непустое.
   * - album — всегда, если incoming.album непустое.
   * - coverUrl — только если был пуст.
   */
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
  }

  /**
   * Снимок метаданных до применения — для отката через «Очистить».
   */
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
