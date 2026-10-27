// src/stores/library/writer/index.ts
import type { LibraryWriter } from '@/plugins/types'
import { useLibraryStore } from '../store'
import { setLibrary } from './library'
import { addFolders, updateFolder, removeFolders, removeBySource } from './folders'
import {
  addTracks,
  removeTracks,
  updateTrackFileLocation,
  updateTrackHandle,
  updateTrackDuration,
  updateTrackMetadata,
  updateTrackSources,
} from './tracks'
import { matchesSource } from './helpers'

export function createLibraryWriter(): LibraryWriter {
  const store = (): ReturnType<typeof useLibraryStore> => useLibraryStore()

  return {
    setLibrary(collected, sourceId) {
      setLibrary(store(), collected, sourceId)
    },
    addFolders(folders, sourceId) {
      addFolders(store(), folders, sourceId)
    },
    updateFolder(folderId, patch) {
      updateFolder(store(), folderId, patch)
    },
    removeFolders(folderIds) {
      removeFolders(store(), folderIds)
    },
    removeBySource(sourceId) {
      removeBySource(store(), sourceId)
    },
    addTracks(tracks, sourceId) {
      addTracks(store(), tracks, sourceId)
    },
    removeTracks(trackIds) {
      removeTracks(store(), trackIds)
    },
    updateTrackFileLocation(trackId, location) {
      updateTrackFileLocation(store(), trackId, location)
    },
    updateTrackHandle(trackId, handle) {
      updateTrackHandle(store(), trackId, handle)
    },
    updateTrackSource(trackId, source) {
      // Оставляем для совместимости со старым интерфейсом, просто добавляем source в массив
      const track = store().getTrack(trackId)
      if (track && source) {
        const exists = track.sources.some((s) => s.url === source)
        if (!exists) {
          updateTrackSources(store(), trackId, [
            ...track.sources,
            { id: trackId, pluginId: track.pluginId, url: source, priority: 20 },
          ])
        }
      }
    },
    updateTrackDuration(trackId, duration) {
      updateTrackDuration(store(), trackId, duration)
    },
    updateTrackMetadata(trackId, patch) {
      updateTrackMetadata(store(), trackId, patch)
    },
    getFolder(folderId) {
      return store().getFolder(folderId)
    },
    getTrack(trackId) {
      return store().getTrack(trackId)
    },
    getFoldersBySource(sourceId) {
      return Object.values(store().folders).filter((f) => matchesSource(f.source, sourceId))
    },
    getTracksBySource(sourceId) {
      return Object.values(store().tracks).filter((t) => matchesSource(t.pluginId, sourceId))
    },
    getCurrentFolderId() {
      return store().currentFolderId
    },
    setCurrentFolder(folderId) {
      store().setCurrentFolder(folderId)
    },
  }
}
