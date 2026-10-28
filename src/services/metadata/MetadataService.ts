// src/services/metadata/MetadataService.ts

import {
  metadataPersistenceService,
  type OriginalMetadata,
} from '@/services/persistence/MetadataPersistenceService'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { loadPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { UNKNOWN_ARTIST_PLACEHOLDER } from './constants'
import type { LibraryTrack, MetadataSource } from '@/types/library'
import type { TrackMetadata } from './types'
import type { RemoteTrackMetadata } from './TrackMetadataService'
import type { TrackSource } from '@/types/track'

export type ApplyResult =
  { status: 'applied' } | { status: 'skipped'; reason: 'protected' | 'not-found' }

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

    if (track.metaSource === 'manual' || track.hasId3Tags) {
      return { status: 'skipped', reason: 'protected' }
    }

    this.saveToCache(track, incoming)

    if (incoming.confident) {
      this.applyPatch(track, incoming, 'auto')
    } else {
      // Сохраняем как альтернативный источник
      const library = useLibraryStore()
      const altSource: TrackSource = {
        id: `metadata:${incoming.artist}:${incoming.title}`,
        pluginId: 'metadata',
        url: incoming.coverUrl || undefined,
        priority: 100,
      }

      if (!track.alternateSources) track.alternateSources = []
      if (!track.alternateSources.some((s) => s.id === altSource.id)) {
        track.alternateSources.push(altSource)
        // Обновляем трек в библиотеке (реактивно)
        library.tracks[trackId] = { ...track }
        this.saveCacheForTrack(track)
      }
    }

    return { status: 'applied' }
  }

  updateManual(trackId: string, patch: ManualPatch): void {
    const library = useLibraryStore()
    const track = library.getTrack(trackId)
    if (!track) return

    library.updateTrackMetadata(trackId, {
      artist: patch.artist,
      title: patch.title,
      album: patch.album,
      metaSource: 'manual',
    })

    this.syncQueue(trackId)

    const updatedTrack = library.getTrack(trackId)
    if (updatedTrack?.albumId) {
      const album = library.getAlbum(updatedTrack.albumId)
      if (album) {
        album.name = patch.album || album.name
        if (patch.coverUrl) album.coverUrl = patch.coverUrl
      }
    }

    metadataPersistenceService.setInMemory(trackId, {
      artist: patch.artist || null,
      title: patch.title,
      album: patch.album || null,
      coverUrl: patch.coverUrl ?? null,
      similarity: 1,
      original: this.buildOriginal(track),
    })

    this.scheduleFlush()
    this.saveCacheForTrack(track)
  }

  applyFromFile(trackId: string, parsed: TrackMetadata): void {
    const library = useLibraryStore()
    const track = library.getTrack(trackId)
    if (!track) return
    if (track.metaSource === 'manual') return

    const patch: Partial<LibraryTrack> = {
      metaSource: 'file',
      hasId3Tags: true,
    }

    if (parsed.title) patch.title = parsed.title
    if (parsed.artist) patch.artist = parsed.artist
    if (parsed.album) patch.album = parsed.album
    if (parsed.duration) patch.duration = parsed.duration

    library.updateTrackMetadata(trackId, patch)

    const updatedTrack = library.getTrack(trackId)
    if (updatedTrack?.albumId && parsed.coverUrl) {
      const album = library.getAlbum(updatedTrack.albumId)
      if (album && !album.coverUrl) {
        album.coverUrl = parsed.coverUrl
      }
    }

    this.syncQueue(trackId)
  }

  async reset(trackId: string): Promise<void> {
    const library = useLibraryStore()
    const track = library.getTrack(trackId)
    if (!track) return

    const raw = track.raw
    let resetCoverUrl: string | undefined = undefined

    if (raw) {
      resetCoverUrl = raw.coverUrl
      library.updateTrackMetadata(trackId, {
        artist: raw.artist,
        title: raw.title,
        album: raw.album,
        metaSource: 'filename',
        hasId3Tags: raw.hasId3Tags ?? false,
      })
    } else {
      const entry = metadataPersistenceService.get(trackId)
      resetCoverUrl = entry?.original?.coverUrl ?? undefined
      library.updateTrackMetadata(trackId, {
        artist: entry?.original?.artist ?? '',
        title: entry?.original?.title ?? track.title,
        album: entry?.original?.album ?? '',
        metaSource: 'filename',
        hasId3Tags: false,
      })
    }

    const updatedTrack = library.getTrack(trackId)
    if (updatedTrack?.albumId && resetCoverUrl) {
      const album = library.getAlbum(updatedTrack.albumId)
      if (album) {
        album.coverUrl = resetCoverUrl
      }
    }

    this.syncQueue(trackId)
    await this.markNotFoundAndFlush(trackId)
    this.saveCacheForTrack(track)
  }

  async resetMany(trackIds: string[]): Promise<void> {
    for (const id of trackIds) {
      await this.reset(id)
    }
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
    const patch: Partial<Pick<LibraryTrack, 'artist' | 'title' | 'album' | 'metaSource'>> = {
      metaSource: source,
    }

    const artist = track.artist?.trim() ?? ''
    if (!artist || artist === UNKNOWN_ARTIST_PLACEHOLDER) {
      if (incoming.artist) patch.artist = incoming.artist
    }
    if (incoming.title) patch.title = incoming.title
    if (incoming.album) patch.album = incoming.album

    const library = useLibraryStore()
    library.updateTrackMetadata(track.id, patch)

    const updatedTrack = library.getTrack(track.id)
    if (updatedTrack?.albumId && incoming.coverUrl) {
      const album = library.getAlbum(updatedTrack.albumId)
      if (album && !album.coverUrl) {
        album.coverUrl = incoming.coverUrl
      }
    }

    this.syncQueue(track.id)
    this.saveCacheForTrack(track)
  }

  private saveCacheForTrack(track: LibraryTrack): void {
    const pluginId = track.pluginId.split(':')[0]
    if (!pluginId) return

    void (async () => {
      try {
        const plugin = await loadPlugin(pluginId)
        if (plugin.saveCache) {
          const context = createPluginContext(pluginId)
          await plugin.saveCache(context)
        }
      } catch (err) {
        console.warn(`[metadata] failed to save cache for ${pluginId}`, err)
      }
    })()
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
    const coverUrl = track.raw?.coverUrl
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
