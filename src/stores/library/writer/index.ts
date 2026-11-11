// src/stores/library/writer/index.ts

import type { LibraryWriter, CleanupScope } from '@/services/library/LibraryWriter';
import type { Album } from '@/types/album';
import type { PluginSnapshot } from '@/types/plugin';
import type { Track } from '@/types/track';
import type { FolderId, TrackId } from '@/types/ids';
import { useLibraryStore } from '../store';
import { mergeMany, applyMany, saveCachesForPlugins, sourceKey } from '@/services/library/TrackMerger';
import { normalizeMatchString } from '@/services/playlists/PlaylistMatcher';
import {
  addTracks,
  removeTrack,
  removeTrackSource,
  updateTrackSources,
  updateTrackAlbumId,
  updateTrackMetadataCandidates,
  updateTrackDuplicates,
  updateTrackMetadata,
} from './tracks';
import { addAlbums, addOrUpdateAlbum, removeAlbum } from './albums';
import {
  setFolders,
  removeFolderRef,
  removeFoldersBySource,
  setFolderScanState,
  updateFolderScanProgress,
  renameFolderSubtree as renameFolderSubtreeImpl,
} from './folders';
import { matchesSource } from './helpers';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { telemetry } from '@/services/telemetry';
import { librarySaveService } from '@/services/library/LibrarySaveService';

function cleanupForceScanInternal(
  s: ReturnType<typeof useLibraryStore>,
  snapshot: PluginSnapshot,
  scope: CleanupScope,
): void {
  // --- 1. Убираем отсутствующие cloud-sources в trackScope ---
  const snapshotRemotePaths = new Set<string>();
  for (const t of snapshot.tracks) {
    if (t.source.kind === 'cloud') {
      snapshotRemotePaths.add(t.source.remotePath);
    }
  }

  for (const track of Object.values(s.tracks)) {
    let changed = false;
    const nextSources = track.sources.filter((src) => {
      if (src.kind !== 'cloud') return true;
      if (!scope.trackScope.has(src.folderId)) return true;
      if (snapshotRemotePaths.has(src.remotePath)) return true;
      changed = true;
      return false;
    });

    if (changed) {
      // ВАЖНО: не удаляем трек, даже если nextSources = [].
      // Трек может быть в другом источнике / плейлисте / истории / дизлайках.
      // Осиротевшие треки (sources=[]) почистит cleanupOrphanTracks.
      updateTrackSources(s, track.id, nextSources);
    }
  }

  // --- 2. Удаляем отсутствующие папки в folderScope ---
  const snapshotFolderIds = new Set<FolderId>();
  for (const f of snapshot.folders) snapshotFolderIds.add(f.id);

  const startFolderId = findStartFolderId(scope.folderScope);
  for (const id of scope.folderScope) {
    if (id === startFolderId) continue;
    if (snapshotFolderIds.has(id)) continue;
    removeFolderRef(s, id);
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

    async addAlbums(albums: Album[]) {
      addAlbums(store(), albums);
    },
    async addOrUpdateAlbum(album: Album) {
      addOrUpdateAlbum(store(), album);
    },
    async removeAlbum(id) {
      removeAlbum(store(), id);
    },

    async addFolders(folders, sourceId) {
      setFolders(store(), folders, sourceId);
    },

    async addTracks(tracks, sourceId) {
      addTracks(store(), tracks, sourceId);
    },
    async removeTrack(id) {
      removeTrack(store(), id);
    },
    async updateTrackSources(id, sources) {
      updateTrackSources(store(), id, sources);
    },
    async removeTrackSource(id, sourceId) {
      removeTrackSource(store(), id, sourceId);
    },
    async updateTrackAlbumId(id, albumId) {
      updateTrackAlbumId(store(), id, albumId);
    },
    async updateTrackMetadataCandidates(id, candidates) {
      updateTrackMetadataCandidates(store(), id, candidates);
    },
    async updateTrackDuplicates(id, duplicateTrackIds) {
      updateTrackDuplicates(store(), id, duplicateTrackIds);
    },
    async updateTrackMetadata(id, patch) {
      updateTrackMetadata(store(), id, patch);
    },

    async setLibrary(snapshot: PluginSnapshot, sourceId: string, opts?: { cleanup?: CleanupScope }) {
      const startTs = performance.now();
      telemetry.event('writer.setLibrary.start', {
        sourceId,
        tracks: snapshot.tracks.length,
        folders: snapshot.folders.length,
      });

      try {
        const pluginIds = applySetLibrary(store(), self, snapshot, sourceId, opts?.cleanup);
        await saveCachesForPlugins(pluginIds);

        telemetry.event('writer.setLibrary.done', {
          sourceId,
          ms: Math.round(performance.now() - startTs),
        });
      } catch (err) {
        telemetry.event('writer.setLibrary.error', {
          sourceId,
          ms: Math.round(performance.now() - startTs),
          msg: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
        });
        throw err;
      }
    },

    async removeBySource(sourceId: string) {
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

    async removeFolderRef(id) {
      removeFolderRef(store(), id);
    },

    async reconcileFolderTrackIds() {
      store().reconcileFolderTrackIds();
    },

    async removeCloudSourcesInFolders(subtreeIds: Set<FolderId>) {
      const s = store();
      const tracksToUpdate: TrackId[] = [];

      for (const track of Object.values(s.tracks)) {
        const hasCloudInSubtree = track.sources.some((src) => src.kind === 'cloud' && subtreeIds.has(src.folderId));
        if (!hasCloudInSubtree) continue;
        tracksToUpdate.push(track.id);
      }

      for (const id of tracksToUpdate) {
        const track = s.tracks[id];
        if (!track) continue;
        const remaining = track.sources.filter((src) => !(src.kind === 'cloud' && subtreeIds.has(src.folderId)));
        updateTrackSources(s, id, remaining);
      }
    },

    async cleanupOrphanAlbums() {
      store().cleanupOrphanAlbums();
    },

    async renameFolderSubtree(oldUrlPath: string, newUrlPath: string) {
      const s = store();
      const { updatedTrackIds } = renameFolderSubtreeImpl(s, oldUrlPath, newUrlPath);

      if (updatedTrackIds.size > 0) {
        const pluginIds = new Set<string>();
        for (const trackId of updatedTrackIds) {
          const track = s.tracks[trackId];
          if (!track) continue;
          for (const src of track.sources) {
            pluginIds.add(src.pluginId);
          }
        }
        for (const pid of pluginIds) {
          librarySaveService.scheduleSave(pid);
        }
      }
    },

    async setFolderScanState(id, state, opts) {
      setFolderScanState(store(), id, state, opts);
    },

    async updateFolderScanProgress(id, progress) {
      updateFolderScanProgress(store(), id, progress);
    },
  };

  return self;
}

function findStartFolderId(scope: Set<FolderId>): FolderId | null {
  const s = useLibraryStore();
  for (const id of scope) {
    const f = s.folders[id];
    if (!f) continue;
    if (f.parentId === null || !scope.has(f.parentId)) return id;
  }
  return null;
}

function applySetLibrary(
  s: ReturnType<typeof useLibraryStore>,
  writer: LibraryWriter,
  snapshot: PluginSnapshot,
  sourceId: string,
  cleanup?: CleanupScope,
): string[] {
  const uiSettings = useUiSettingsStore();

  if (snapshot.removedSourceIds && snapshot.removedSourceIds.length > 0) {
    const toRemove = new Set(snapshot.removedSourceIds);
    for (const track of Object.values(s.tracks)) {
      const nextSources = track.sources.filter((src) => !toRemove.has(src.id));
      if (nextSources.length === track.sources.length) continue;
      updateTrackSources(s, track.id, nextSources);
    }
  }

  if (snapshot.removedFolderIds && snapshot.removedFolderIds.length > 0) {
    for (const id of snapshot.removedFolderIds) {
      removeFolderRef(s, id);
    }
  }

  setFolders(s, snapshot.folders, sourceId);

  const libraryIndex = new Map<string, Track[]>();
  for (const track of Object.values(s.tracks)) {
    const artistKey = normalizeMatchString(track.artist);
    const list = libraryIndex.get(artistKey) || [];
    list.push(track);
    libraryIndex.set(artistKey, list);
  }

  const sourceIndex = new Map<string, Track>();
  for (const track of Object.values(s.tracks)) {
    for (const src of track.sources) {
      sourceIndex.set(sourceKey(src), track);
    }
  }

  const mergeResult = mergeMany(snapshot.tracks, {
    libraryIndex,
    existingAlbums: Object.values(s.albums),
    threshold: uiSettings.playlistMatchThreshold,
    sourceIndex,
  });

  const pluginIds = applyMany(mergeResult, { writer });

  if (cleanup) {
    cleanupForceScanInternal(s, snapshot, cleanup);
  }

  return pluginIds;
}
