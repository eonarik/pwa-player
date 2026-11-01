// src/stores/library/writer/index.ts

import type { LibraryWriter } from '@/services/library/LibraryWriter';
import type { Album } from '@/types/album';
import type { PluginSnapshot } from '@/types/plugin';
import type { Track } from '@/types/track';
import { useLibraryStore } from '../store';
import { mergeMany, applyMany } from '@/services/library/TrackMerger';
import {
  addTracks,
  removeTrack,
  updateTrackSources,
  updateTrackAlbumId,
  updateTrackMetadataCandidates,
  updateTrackMetadata,
} from './tracks';
import { addAlbums, addOrUpdateAlbum, removeAlbum } from './albums';
import { setFolders, removeFolderRef, removeFoldersBySource } from './folders';
import { matchesSource } from './helpers';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { useUiSettingsStore } from '@/stores/uiSettings';

async function saveCache(pluginId: string): Promise<void> {
  if (!pluginId) return;
  try {
    const plugin = await loadPlugin(pluginId);
    if (plugin.saveCache) {
      const context = createPluginContext(pluginId);
      await plugin.saveCache(context);
    }
  } catch (err) {
    console.warn(`[writer] failed to save cache for ${pluginId}`, err);
  }
}

export function createLibraryWriter(): LibraryWriter {
  const store = (): ReturnType<typeof useLibraryStore> => useLibraryStore();

  const self: LibraryWriter = {
    getTrack(id) {
      return store().tracks[id] ?? null;
    },
    getAlbum(id) {
      return store().albums[id] ?? null;
    },
    getFolder(id) {
      return store().folders[id] ?? null;
    },
    getFoldersBySource(sourceId) {
      return Object.values(store().folders).filter((f) => matchesSource(f.pluginId, sourceId));
    },
    getAllTracks() {
      return Object.values(store().tracks);
    },
    getAllAlbums() {
      return Object.values(store().albums);
    },

    addAlbums(albums: Album[]) {
      addAlbums(store(), albums);
    },
    addOrUpdateAlbum(album: Album) {
      addOrUpdateAlbum(store(), album);
    },
    removeAlbum(id) {
      removeAlbum(store(), id);
    },

    addFolders(folders, sourceId) {
      setFolders(store(), folders, sourceId);
    },

    addTracks(tracks, sourceId) {
      addTracks(store(), tracks, sourceId);
    },
    removeTrack(id) {
      removeTrack(store(), id);
    },
    updateTrackSources(id, sources) {
      updateTrackSources(store(), id, sources);
    },
    updateTrackAlbumId(id, albumId) {
      updateTrackAlbumId(store(), id, albumId);
    },
    updateTrackMetadataCandidates(id, candidates) {
      updateTrackMetadataCandidates(store(), id, candidates);
    },
    updateTrackMetadata(id, patch) {
      updateTrackMetadata(store(), id, patch);
    },

    async setLibrary(snapshot: PluginSnapshot, sourceId: string) {
      const s = store();
      const uiSettings = useUiSettingsStore();

      if (snapshot.removedSourceIds && snapshot.removedSourceIds.length > 0) {
        const toRemove = new Set(snapshot.removedSourceIds);
        for (const track of Object.values(s.tracks)) {
          const nextSources = track.sources.filter((src) => !toRemove.has(src.id));
          if (nextSources.length === track.sources.length) continue;

          if (nextSources.length === 0) {
            removeTrack(s, track.id);
          } else {
            updateTrackSources(s, track.id, nextSources);
          }
        }
      }

      if (snapshot.removedFolderIds && snapshot.removedFolderIds.length > 0) {
        for (const id of snapshot.removedFolderIds) {
          removeFolderRef(s, id);
        }
      }

      setFolders(s, snapshot.folders, sourceId);

      // Строим индекс артистов из текущей библиотеки
      const libraryIndex = new Map<string, Track[]>();
      for (const track of Object.values(s.tracks)) {
        const artistKey = (track.artist || '').trim().toLowerCase();
        const list = libraryIndex.get(artistKey) || [];
        list.push(track);
        libraryIndex.set(artistKey, list);
      }

      const mergeResult = mergeMany(snapshot.tracks, {
        libraryIndex,
        existingAlbums: Object.values(s.albums),
        threshold: uiSettings.playlistMatchThreshold,
      });

      await applyMany(mergeResult, {
        writer: self,
        saveCache,
      });
    },

    removeBySource(sourceId) {
      const s = store();

      removeFoldersBySource(s, sourceId);

      for (const track of Object.values(s.tracks)) {
        const remainingSources = track.sources.filter((src) => !matchesSource(src.pluginId, sourceId));

        if (remainingSources.length !== track.sources.length) {
          updateTrackSources(s, track.id, remainingSources);
        }
      }

      s.reconcileFolderTrackIds();
    },

    removeFolderRef(id) {
      removeFolderRef(store(), id);
    },

    reconcileFolderTrackIds() {
      store().reconcileFolderTrackIds();
    },
  };

  return self;
}
