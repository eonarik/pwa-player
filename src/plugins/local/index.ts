// src/plugins/local/index.ts

import { toRaw } from 'vue';
import type { LibrarySource, PluginContext, LoadOptions } from '../types';
import type { PluginSnapshot } from '../types';
import type { FolderId } from '@/types/ids';
import { newFolderId } from '@/types/ids';
import { fileSystemService } from './FileSystemService';
import { localPersistenceService } from './persistence';
import { newTrackId, newTrackSourceId } from '@/types/ids';
import { folderStatusService } from '@/services/folders/FolderStatusService';

const PLUGIN_ID = 'local';
const CONNECTED_KEY = 'local-connected';
const FOLDER_MAP_KEY = 'local:folderMap';
const ROOT_FOLDER_ID_KEY = 'local:rootFolderId';

const localPlugin: LibrarySource = {
  id: PLUGIN_ID,
  name: 'Локальная папка',
  icon: '📁',

  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  },

  isDisconnected(): boolean {
    return localStorage.getItem(CONNECTED_KEY) !== 'true';
  },

  async connect(_context: PluginContext): Promise<void> {
    if (!fileSystemService.supported) {
      throw new Error('File System Access API не поддерживается. Используйте Chrome/Edge на десктопе.');
    }
    const handle = await fileSystemService.pickDirectory();
    if (!handle) throw new Error('cancelled');
    await fileSystemService.addHandle(handle);
    localStorage.setItem(CONNECTED_KEY, 'true');
  },

  async load(context: PluginContext, _options?: LoadOptions): Promise<PluginSnapshot> {
    const handles = await fileSystemService.getHandles();
    if (handles.length === 0) {
      return { folders: [], tracks: [] };
    }

    const folderMap = (await context.storage.get<Record<string, string>>(FOLDER_MAP_KEY)) ?? {};
    const rootFolderId = (await context.storage.get<FolderId>(ROOT_FOLDER_ID_KEY)) ?? newFolderId();

    const allFolders: PluginSnapshot['folders'] = [];
    const allTracks: PluginSnapshot['tracks'] = [];
    const newFolderMap: Record<string, string> = { ...folderMap };
    let firstRoot = true;

    for (const handle of handles) {
      const granted = await fileSystemService.verifyPermission(handle, 'read');
      if (!granted) continue;

      const handleRootId = firstRoot ? rootFolderId : newFolderId();
      firstRoot = false;

      if (handles[0] && handle.name === handles[0].name) {
        newFolderMap[''] = handleRootId;
      } else {
        newFolderMap[handle.name] = handleRootId;
      }

      const { snapshot, newFolderMap: updatedMap } = await fileSystemService.collectLibrary(
        handle,
        handleRootId,
        newFolderMap,
      );

      allFolders.push(...snapshot.folders);
      allTracks.push(...snapshot.tracks);
      Object.assign(newFolderMap, updatedMap);
    }

    await context.storage.set(FOLDER_MAP_KEY, newFolderMap);
    await context.storage.set(ROOT_FOLDER_ID_KEY, rootFolderId);

    // Сохраняем в локальный кэш (для восстановления без диска)
    // Используем structuredClone для глубокого снятия Proxy,
    // так как JSON.stringify убивает FileSystemFileHandle
    const safeFolders = structuredClone(toRaw(allFolders));
    const safeTracks = structuredClone(toRaw(allTracks));

    await localPersistenceService.save({
      folders: safeFolders.map((f) => ({ ...f, pluginId: PLUGIN_ID, trackIds: f.trackIds || [] })),
      tracks: safeTracks.map((t) => ({
        id: newTrackId(),
        pluginId: PLUGIN_ID,
        artist: t.artist,
        title: t.title,
        albumId: null,
        coverUrl: t.coverUrl,
        sources: [{ ...t.source, id: newTrackSourceId() }],
        metadataCandidates: [],
        raw: {
          artist: t.artist,
          title: t.title,
          album: t.album,
          coverUrl: t.coverUrl,
        },
        hasId3Tags: t.hasId3Tags,
        metaSource: t.metaSource,
        hasMetadataEdits: t.hasMetadataEdits,
        duration: t.duration,
        codec: t.codec,
      })),
      folderMap: newFolderMap,
      rootFolderId,
      rootFolderName: 'Локальная папка',
      savedAt: Date.now(),
    });

    // Регистрируем папки как scanned, так как локальный скан происходит мгновенно
    for (const f of allFolders) {
      folderStatusService.register(f.id, 'scanned');
    }

    return { folders: allFolders, tracks: allTracks };
  },

  async restoreFromCache(_context: PluginContext): Promise<PluginSnapshot | null> {
    const persisted = await localPersistenceService.load();
    if (!persisted || persisted.folders.length === 0) return null;

    // Регистрируем папки из кеша как scanned
    for (const f of persisted.folders) {
      folderStatusService.register(f.id as FolderId, 'scanned');
    }

    return {
      folders: persisted.folders.map((f) => ({
        id: f.id as FolderId,
        parentId: f.parentId as FolderId | null,
        name: f.name,
        urlPath: f.urlPath,
      })),
      tracks: persisted.tracks.map((t) => {
        const firstSource = t.sources[0];
        if (!firstSource || firstSource.kind !== 'local') {
          throw new Error(`[local-plugin] invalid source for track "${t.title}"`);
        }
        return {
          artist: t.artist,
          title: t.title,
          album: t.raw?.album ?? '',
          coverUrl: t.coverUrl,
          duration: t.duration,
          codec: t.codec,
          hasId3Tags: t.hasId3Tags,
          metaSource: t.metaSource,
          hasMetadataEdits: t.hasMetadataEdits,
          source: {
            pluginId: PLUGIN_ID,
            priority: 10,
            kind: 'local',
            handle: firstSource.handle,
            folderId: firstSource.folderId,
          },
        };
      }),
    };
  },

  async scanFolder(_context: PluginContext, _folderId: FolderId, _options): Promise<PluginSnapshot> {
    return { folders: [], tracks: [] };
  },

  buildStreamUrl(_source): string {
    throw new Error('[local-plugin] buildStreamUrl is not supported (use handle.getFile())');
  },

  canDownload: false,

  async disconnect(context: PluginContext): Promise<void> {
    localStorage.removeItem(CONNECTED_KEY);
    context.writer.removeBySource(PLUGIN_ID);
    await localPersistenceService.clear();
    await fileSystemService.clearHandles();
    await context.storage.clear();
    // На самом деле, лучше удалять только папки этого плагина, но так как
    // folderStatusService не знает о pluginId, удалим все (в рамках disconnect)
    folderStatusService.clear();
  },
};

export default localPlugin;
