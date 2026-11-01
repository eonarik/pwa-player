// src/stores/library/writer/index.ts

import type { LibraryWriter } from '@/services/library/LibraryWriter';
import type { Album } from '@/types/album';
import type { PluginSnapshot } from '@/types/plugin';
import type { Track } from '@/types/track';
import type { FolderId, TrackId } from '@/types/ids';
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
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { useUiSettingsStore } from '@/stores/uiSettings';

async function saveCache(pluginId: string): Promise<void> {
  if (!pluginId) return;
  try {
    const plugin = await loadPlugin(pluginIdFromSource(pluginId));
    if (plugin.saveCache) {
      const context = createPluginContext(pluginIdFromSource(pluginId));
      await plugin.saveCache(context);
    }
  } catch (err) {
    console.warn(`[writer] failed to save cache for ${pluginId}`, err);
  }
}

/**
 * Мьютекс на `setLibrary`. Сериализует параллельные вызовы
 * (например, `onChunk` из scanAll + force scan) — предотвращает
 * race condition при создании альбомов (см. 0.13.2).
 */
let setLibraryChain: Promise<void> = Promise.resolve();

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
      // Мьютекс: сериализуем параллельные вызовы.
      const prev = setLibraryChain;
      let resolveChain!: () => void;
      setLibraryChain = new Promise<void>((r) => {
        resolveChain = r;
      });

      await prev;
      try {
        await applySetLibrary(store(), self, snapshot, sourceId);
      } finally {
        resolveChain();
      }
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

    removeCloudSourcesInFolders(subtreeIds: Set<FolderId>) {
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

    cleanupForceScan(subtreeIds: Set<FolderId>, snapshot: PluginSnapshot) {
      const s = store();

      // 1. Множество remotePath из snapshot (для проверки «трек ещё есть в облаке»).
      const snapshotRemotePaths = new Set<string>();
      for (const t of snapshot.tracks) {
        if (t.source.kind === 'cloud') {
          snapshotRemotePaths.add(t.source.remotePath);
        }
      }

      // 2. Удаляем cloud-sources в поддереве, чьих remotePath нет в snapshot.
      const tracksToRemove: TrackId[] = [];
      for (const track of Object.values(s.tracks)) {
        let changed = false;
        const nextSources = track.sources.filter((src) => {
          if (src.kind !== 'cloud') return true;
          if (!subtreeIds.has(src.folderId)) return true;
          // cloud-source в поддереве — оставляем, если remotePath есть в snapshot.
          if (snapshotRemotePaths.has(src.remotePath)) return true;
          changed = true;
          return false;
        });

        if (changed) {
          if (nextSources.length === 0) {
            tracksToRemove.push(track.id);
          } else {
            updateTrackSources(s, track.id, nextSources);
          }
        }
      }

      // 3. Удаляем треки без sources, которые не используются.
      //    (Полная проверка использования — в cleanupOrphanTracks на bootstrap,
      //    здесь удаляем только те, у кого sources пусты и нет albumId-«якоря».)
      for (const id of tracksToRemove) {
        const track = s.tracks[id];
        if (!track) continue;
        // Если у трека есть albumId, но нет sources — он «мёртвый», но альбом
        // может быть нужен. Удаляем трек, альбом почистит cleanupOrphanAlbums.
        removeTrack(s, id);
      }

      // 4. Удаляем папки поддерева, которых нет в snapshot.
      const snapshotFolderIds = new Set<FolderId>();
      for (const f of snapshot.folders) snapshotFolderIds.add(f.id);
      snapshotFolderIds.add(snapshot.folders[0]?.parentId ?? (undefined as never)); // защита
      // На самом деле стартовая папка не в snapshot.folders (её не пушит scanAll),
      // поэтому просто проверим, что папка в subtreeIds и нет в snapshotFolderIds.
      // Стартовую папку не трогаем — она «якорь».
      const startFolderId = findStartFolderId(subtreeIds);
      for (const id of subtreeIds) {
        if (id === startFolderId) continue; // не удаляем стартовую
        if (snapshotFolderIds.has(id)) continue;
        removeFolderRef(s, id);
      }
    },

    cleanupOrphanAlbums() {
      store().cleanupOrphanAlbums();
    },
  };

  return self;
}

/**
 * Находит «стартовую» папку поддерева — ту, у которой `parentId` не входит в `subtreeIds`.
 * Обычно это сама папка force scan.
 */
function findStartFolderId(subtreeIds: Set<FolderId>): FolderId | null {
  const s = useLibraryStore();
  for (const id of subtreeIds) {
    const f = s.folders[id];
    if (!f) continue;
    if (f.parentId === null || !subtreeIds.has(f.parentId)) return id;
  }
  return null;
}

async function applySetLibrary(
  s: ReturnType<typeof useLibraryStore>,
  writer: LibraryWriter,
  snapshot: PluginSnapshot,
  sourceId: string,
): Promise<void> {
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
    writer,
    saveCache,
  });
}
