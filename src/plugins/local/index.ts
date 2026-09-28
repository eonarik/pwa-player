// src/plugins/local/index.ts

import type { LibrarySource, LoadOptions, PluginContext } from '../types'
import type { CollectedLibrary, Folder, LibraryTrack } from '@/types/library'
import type { Track } from '@/types/track'
import { fileSystemService } from './FileSystemService'
import { localPersistenceService } from './persistence'
import type { PersistedLocalFolder, PersistedLocalLibrary, PersistedLocalTrack } from './types'
import { coverPersistenceService } from '@/services/persistence/CoverPersistenceService'
import { findCoverInDirectory } from '@/services/covers/findCoverInDirectory'

const PLUGIN_ID = 'local'

/**
 * Плагин локальной папки.
 *
 * Работает через File System Access API. handle сохраняется в IDB,
 * чтобы при следующем запуске можно было восстановить библиотеку
 * без повторного выбора папки.
 */
const localPlugin: LibrarySource = {
  id: PLUGIN_ID,
  name: 'Локальная папка',
  icon: '📁',

  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window
  },

  // --- Подключение ----------------------------------------------------

  async connect(_context: PluginContext): Promise<void> {
    const handle = await fileSystemService.pickDirectory()
    if (!handle) {
      throw new Error('cancelled')
    }
  },

  // --- Загрузка -------------------------------------------------------

  async load(context: PluginContext, _options?: LoadOptions): Promise<void> {
    const handle = await fileSystemService.restoreHandle()
    if (!handle) {
      throw new Error('[local-plugin] no saved directory handle')
    }

    const granted = await fileSystemService.verifyPermission(handle, 'read')
    if (!granted) {
      throw new Error('[local-plugin] permission denied')
    }

    const collected = await fileSystemService.collectLibrary(handle)
    context.writer.setLibrary(collected, PLUGIN_ID)

    await localPersistenceService.save(toPersisted(collected))
  },

  // --- Восстановление из кэша -----------------------------------------

  async restoreFromCache(context: PluginContext): Promise<boolean> {
    const persisted = await localPersistenceService.load()
    if (!persisted || persisted.folders.length === 0) {
      return false
    }

    const newFolders: Record<string, Folder> = {}
    for (const f of persisted.folders) {
      newFolders[f.id] = {
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        path: f.path,
        handle: f.handle,
        childFolderIds: [...f.childFolderIds],
        trackIds: [...f.trackIds],
        totalTrackCount: f.totalTrackCount,
        source: PLUGIN_ID,
      }
    }

    const newTracks: Record<string, LibraryTrack> = {}
    const failedTrackIds: string[] = []

    await Promise.all(
      persisted.tracks.map(async (t) => {
        try {
          if (!t.handle) throw new Error('no handle')
          const file = await t.handle.getFile()
          const folder = newFolders[t.folderId]
          const cachedCover = coverPersistenceService.get(t.id)

          newTracks[t.id] = {
            id: t.id,
            pluginId: t.pluginId,
            folderId: t.folderId,
            title: t.title,
            artist: t.artist,
            album: t.album,
            year: t.year,
            trackNumber: t.trackNumber,
            genre: t.genre,
            duration: t.duration,
            codec: t.codec,
            filename: t.filename,
            path: t.path,
            handle: t.handle,
            directoryHandle: folder?.handle,
            source: file,
            coverUrl: cachedCover ?? undefined,
          }
        } catch (err) {
          console.warn(`[local-plugin] can't restore file for "${t.title}"`, err)
          failedTrackIds.push(t.id)
        }
      }),
    )

    if (persisted.tracks.length > 0 && Object.keys(newTracks).length === 0) {
      console.warn('[local-plugin] all tracks failed to restore — permission lost')
      return false
    }

    if (failedTrackIds.length > 0) {
      const failedSet = new Set(failedTrackIds)
      for (const folder of Object.values(newFolders)) {
        folder.trackIds = folder.trackIds.filter((id) => !failedSet.has(id))
      }
    }

    await restoreCoversFromFolders(newFolders, newTracks)

    const collected: CollectedLibrary = {
      folders: Object.values(newFolders),
      tracks: Object.values(newTracks),
      rootFolderId: persisted.rootFolderId,
      rootFolderName: persisted.rootFolderName,
    }
    context.writer.setLibrary(collected, PLUGIN_ID)

    return true
  },

  // --- Стриминг -------------------------------------------------------

  buildStreamUrl(track: Track): string {
    if (typeof track.source === 'string') {
      return track.source
    }
    throw new Error('[local-plugin] buildStreamUrl is not supported for local files')
  },

  canDownload: false,

  // --- Отключение -----------------------------------------------------

  async disconnect(context: PluginContext): Promise<void> {
    context.writer.removeBySource(PLUGIN_ID)
    await localPersistenceService.clear()
    await fileSystemService.clearHandle()
    await context.storage.clear()
  },
}

// --- Вспомогательные ---------------------------------------------------

function toPersisted(collected: CollectedLibrary): PersistedLocalLibrary {
  const folders: PersistedLocalFolder[] = []
  for (const folder of collected.folders) {
    if (!folder.handle) continue
    folders.push({
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      path: folder.path,
      handle: folder.handle,
      childFolderIds: [...folder.childFolderIds],
      trackIds: [...folder.trackIds],
      totalTrackCount: folder.totalTrackCount,
    })
  }

  const tracks: PersistedLocalTrack[] = []
  for (const track of collected.tracks) {
    if (!track.handle) continue
    tracks.push({
      id: track.id,
      pluginId: track.pluginId,
      folderId: track.folderId,
      title: track.title,
      artist: track.artist,
      album: track.album,
      year: track.year,
      trackNumber: track.trackNumber,
      genre: track.genre,
      duration: track.duration,
      codec: track.codec,
      filename: track.filename,
      path: track.path!,
      handle: track.handle,
    })
  }

  return {
    folders,
    tracks,
    rootFolderId: collected.rootFolderId,
    rootFolderName: collected.rootFolderName,
    savedAt: Date.now(),
  }
}

async function restoreCoversFromFolders(
  folders: Record<string, Folder>,
  tracks: Record<string, LibraryTrack>,
): Promise<void> {
  const foldersWithTracks = Object.values(folders).filter((f) => f.trackIds.length > 0 && f.handle)
  if (foldersWithTracks.length === 0) return

  const CONCURRENCY = 6
  let cursor = 0

  const worker = async (): Promise<void> => {
    while (cursor < foldersWithTracks.length) {
      const folder = foldersWithTracks[cursor++]!
      if (!folder.handle) continue
      try {
        const coverFile = await findCoverInDirectory(folder.handle)
        if (!coverFile) continue

        const coverUrl = URL.createObjectURL(coverFile)
        for (const trackId of folder.trackIds) {
          const track = tracks[trackId]
          if (track && !track.coverUrl) track.coverUrl = coverUrl
        }
      } catch (err) {
        console.warn(`[local-plugin] can't restore cover for folder "${folder.name}"`, err)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, foldersWithTracks.length) }, () => worker()),
  )
}

export default localPlugin
