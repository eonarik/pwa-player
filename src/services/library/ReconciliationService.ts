// src/services/library/ReconciliationService.ts

import { useLibraryStore } from '@/stores/library'
import { usePlaylistsStore } from '@/stores/playlists'
import { useHistoryStore } from '@/stores/history'
import { useDislikesStore } from '@/stores/dislikes'
import { virtualTracksService } from '@/services/persistence/VirtualTracksService'
import { findBestMatch } from '@/services/playlists/PlaylistMatcher'
import { loadPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { buildEntitiesForTrack } from '@/services/library/EntityGraph'

class ReconciliationService {
  private static instance: ReconciliationService | null = null
  private isRunning = false

  static getInstance(): ReconciliationService {
    if (!ReconciliationService.instance) {
      ReconciliationService.instance = new ReconciliationService()
    }
    return ReconciliationService.instance
  }

  async reconcile(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true

    try {
      const library = useLibraryStore()
      const playlists = usePlaylistsStore()
      const history = useHistoryStore()
      const dislikes = useDislikesStore()

      const virtualTracks = Object.values(library.virtualTracks)
      const localTracks = Object.values(library.tracks).filter((t) => !t.isVirtual)

      if (virtualTracks.length === 0 || localTracks.length === 0) return

      let hasChanges = false

      for (const virtual of virtualTracks) {
        if (!library.virtualTracks[virtual.id]) continue

        const { track: match, score } = findBestMatch(virtual, localTracks, 0.7)

        if (match && score >= 0.7) {
          const targetId = match.id
          const sourceId = virtual.id

          // 1. Переносим sources
          const newSources = [...match.sources]
          for (const src of virtual.sources) {
            if (!newSources.some((s) => s.id === src.id)) {
              newSources.push(src)
            }
          }
          newSources.sort((a, b) => a.priority - b.priority)
          match.sources = newSources

          // 2. Обогащаем метаданные
          if (!match.album && virtual.album) match.album = virtual.album
          if (!match.artist && virtual.artist) match.artist = virtual.artist

          // Берем обложку напрямую из трека или его raw
          const virtualCover = virtual.coverUrl || virtual.raw?.coverUrl

          // 3. Если у локального трека не было albumId, но теперь есть album — создаем сущность
          if (!match.albumId && match.album) {
            const { track: updatedTrack, album: newAlbum } = buildEntitiesForTrack(match)
            match.albumId = updatedTrack.albumId

            if (newAlbum) {
              const existing = library.getAlbum(newAlbum.id)
              if (existing) {
                if (!existing.trackIds.includes(match.id)) existing.trackIds.push(match.id)
                if (!existing.coverUrl && virtualCover) existing.coverUrl = virtualCover
              } else {
                newAlbum.coverUrl = virtualCover
                library.albums[newAlbum.id] = newAlbum
              }
            }
          }

          // 4. Обновляем существующий альбом
          if (match.albumId) {
            const album = library.getAlbum(match.albumId)
            if (album) {
              let albumUpdated = false

              if (!album.coverUrl && virtualCover) {
                album.coverUrl = virtualCover
                albumUpdated = true
              }
              if (!album.trackIds.includes(match.id)) {
                album.trackIds.push(match.id)
                albumUpdated = true
              }
              if (albumUpdated) {
                library.albums[album.id] = album
              }
            }
          }

          // 5. Заменяем ID в коллекциях
          this.replaceTrackIdInCollections(sourceId, targetId, { playlists, history, dislikes })

          // 6. Удаляем виртуальный трек
          library.removeVirtualTrack(sourceId)
          hasChanges = true
        }
      }

      if (hasChanges) {
        await virtualTracksService.saveAll(library.virtualTracks)

        // Сохраняем кеши плагинов
        const affectedPlugins = new Set<string>()
        for (const track of localTracks) {
          if (track.pluginId) affectedPlugins.add(track.pluginId)
        }
        for (const pluginId of affectedPlugins) {
          try {
            const plugin = await loadPlugin(pluginId)
            if (plugin.saveCache) {
              const context = createPluginContext(pluginId)
              await plugin.saveCache(context)
            }
          } catch (err) {
            console.warn(`[reconciliation] failed to save cache for ${pluginId}`, err)
          }
        }

        playlists.save()
        history.save()
        dislikes.save()
      }
    } catch (err) {
      console.error('[reconciliation] failed', err)
    } finally {
      this.isRunning = false
    }
  }

  private replaceTrackIdInCollections(
    oldId: string,
    newId: string,
    stores: {
      playlists: ReturnType<typeof usePlaylistsStore>
      history: ReturnType<typeof useHistoryStore>
      dislikes: ReturnType<typeof useDislikesStore>
    },
  ): void {
    const { playlists, history, dislikes } = stores

    for (const playlist of Object.values(playlists.playlists)) {
      const index = playlist.trackIds.indexOf(oldId)
      if (index !== -1) {
        playlist.trackIds[index] = newId
        playlist.trackIds = Array.from(new Set(playlist.trackIds))
        playlist.updatedAt = Date.now()
      }
    }

    for (const entry of history.entries) {
      if (entry.trackId === oldId) entry.trackId = newId
    }
    const seenHistory = new Set<string>()
    history.entries = history.entries.filter((e) => {
      if (seenHistory.has(e.trackId)) return false
      seenHistory.add(e.trackId)
      return true
    })

    for (const entry of dislikes.entries) {
      if (entry.trackId === oldId) entry.trackId = newId
    }
    const seenDislikes = new Set<string>()
    dislikes.entries = dislikes.entries.filter((e) => {
      if (seenDislikes.has(e.trackId)) return false
      seenDislikes.add(e.trackId)
      return true
    })
  }
}

export const reconciliationService = ReconciliationService.getInstance()
