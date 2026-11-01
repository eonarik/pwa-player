// src/plugins/yandexDisk/localRestore.ts

import type { PluginContext, PluginSnapshot } from '../types';
import type { FolderId } from '@/types/ids';
import { newFolderId } from '@/types/ids';
import { scanDirectory } from '@/services/download/scanDirectory';
import { isAudioFile } from '@/shared/audioExtensions';
import { guessMetadataFromFilename } from '@/utils/parseFilename';
import { folderStatusService } from '@/services/folders/FolderStatusService';
import type { PluginStorage } from './storage';

export async function restoreFromLocalFilesImpl(
  pluginId: string,
  context: PluginContext,
  storage: PluginStorage,
): Promise<PluginSnapshot | null> {
  const targetDir = await context.getDownloadDir?.();
  if (!targetDir) return null;

  const filesMap = await scanDirectory(targetDir);
  if (filesMap.size === 0) return null;

  const folders: PluginSnapshot['folders'] = [];
  const tracks: PluginSnapshot['tracks'] = [];

  // Ищем существующие папки, чтобы не дублировать их
  const existingFolders = context.writer.getFoldersBySource(pluginId);
  const existingByPath = new Map<string, FolderId>();
  for (const f of existingFolders) {
    existingByPath.set(f.urlPath, f.id);
  }

  const folderMap = new Map<string, FolderId>();
  // Корень
  const existingRoot = existingFolders.find((f) => f.parentId === null);
  const rootId = existingRoot ? existingRoot.id : newFolderId();

  folderMap.set('', rootId);
  if (!existingRoot) {
    folders.push({ id: rootId, parentId: null, name: 'Яндекс.Диск', urlPath: '', files: [] });
  }
  folderStatusService.register(rootId, 'scanned');

  for (const [relativePath, fileInfo] of filesMap.entries()) {
    if (!isAudioFile(fileInfo.handle.name)) continue;

    const parts = relativePath.split('/');
    const fileName = parts.pop()!;

    let currentPath = '';
    let parentId: FolderId = rootId;

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let folderId = folderMap.get(currentPath) || existingByPath.get(currentPath);

      if (!folderId) {
        folderId = newFolderId();
        folders.push({
          id: folderId,
          parentId,
          name: part,
          urlPath: currentPath,
          files: [],
        });
      }

      folderMap.set(currentPath, folderId);
      folderStatusService.register(folderId, 'scanned');
      parentId = folderId;
    }

    const guessed = guessMetadataFromFilename(fileName);
    tracks.push({
      artist: guessed.artist,
      title: guessed.title,
      album: '',
      coverUrl: null,
      hasId3Tags: false,
      metaSource: 'filename',
      source: {
        pluginId,
        priority: 10,
        kind: 'local',
        handle: fileInfo.handle,
        folderId: parentId,
      },
    });
  }

  if (tracks.length === 0) return null;

  // Мержим pathMap (не перезаписываем!)
  const currentPathMap = storage.getPathMap();
  const newPathMap = { ...currentPathMap };

  for (const [urlPath, folderId] of folderMap.entries()) {
    // Если для папки еще нет пути, ставим дефолтный
    if (!newPathMap[folderId]) {
      newPathMap[folderId] = `disk:/${urlPath}`;
    }
  }

  storage.setPathMap(newPathMap);
  storage.setFoldersCache(storage.mergeFoldersCache(storage.getFoldersCache() ?? [], folders));

  return { folders, tracks };
}
