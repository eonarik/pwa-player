// src/plugins/yandexDisk/scan.ts

import type { PluginSnapshot } from '../types';
import type { IYandexService } from './types';
import type { FolderId } from '@/types/ids';
import { newFolderId } from '@/types/ids';
import { guessMetadataFromFilename } from '@/utils/parseFilename';

export const ROOT_REMOTE_PATH = 'disk:/';

export function isTextFile(name: string): boolean {
  return name.toLowerCase().endsWith('.txt');
}

export interface ScanProgressCallback {
  onStart: (folderId: FolderId) => void;
  onDone: (folderId: FolderId) => void;
  onError: (folderId: FolderId, error: unknown) => void;
  onChunk?: (folders: PluginSnapshot['folders'], tracks: PluginSnapshot['tracks']) => void;
}

export interface ScanAllOptions {
  recursive: boolean;
  progress?: ScanProgressCallback;
}

export interface ScanAllResult {
  snapshot: PluginSnapshot;
  newFolderMap: Record<string, string>;
  pathMap: Record<string, string>;
}

export async function scanAll(
  pluginId: string,
  service: IYandexService,
  folderMap: Record<string, string>,
  startFolderId: FolderId,
  startRemotePath: string = ROOT_REMOTE_PATH,
  options: ScanAllOptions,
): Promise<ScanAllResult> {
  const folders: PluginSnapshot['folders'] = [];
  const tracks: PluginSnapshot['tracks'] = [];

  const newFolderMap: Record<string, string> = { ...folderMap };
  const pathMap: Record<string, string> = {};
  const progress = options.progress;

  const walk = async (
    remotePath: string,
    parentId: FolderId | null,
    currentFolderId: FolderId,
    isStart: boolean = false,
  ): Promise<void> => {
    if (service.isCancelled?.()) return;

    pathMap[currentFolderId] = remotePath;

    if (!isStart) {
      const name = remotePath.split('/').filter(Boolean).pop() || 'Папка';
      folders.push({
        id: currentFolderId,
        parentId,
        name,
        urlPath: remotePath === ROOT_REMOTE_PATH ? '' : remotePath.replace(/^disk:\//, ''),
      });
    }

    progress?.onStart(currentFolderId);

    let hasError = false;
    const childDirs: Array<{ id: FolderId; name: string; remotePath: string }> = [];

    try {
      const response = await service.listResources(remotePath);
      const items = response._embedded?.items || response.items || [];

      const currentLevelFolders: PluginSnapshot['folders'] = [];
      const currentLevelTracks: PluginSnapshot['tracks'] = [];

      for (const item of items) {
        if (item.type === 'dir') {
          const childPath = item.path;
          const existingId = newFolderMap[childPath];
          const childFolderId = existingId ? (existingId as FolderId) : newFolderId();
          newFolderMap[childPath] = childFolderId;

          // ВСЕГДА добавляем папку в список (чтобы onChunk ее увидел)
          const folder = {
            id: childFolderId,
            parentId: currentFolderId,
            name: item.name,
            urlPath: childPath.replace(/^disk:\//, ''),
          };
          folders.push(folder);
          currentLevelFolders.push(folder);
          pathMap[childFolderId] = childPath;

          if (options.recursive) {
            childDirs.push({
              id: childFolderId,
              name: item.name,
              remotePath: childPath,
            });
          }
        } else if (item.isAudio) {
          const guessed = guessMetadataFromFilename(item.name);
          const track = {
            artist: guessed.artist,
            title: guessed.title,
            album: '',
            coverUrl: null,
            duration: undefined,
            codec: undefined,
            hasId3Tags: false,
            metaSource: 'filename' as const,
            hasMetadataEdits: false,
            source: {
              pluginId,
              priority: 20,
              kind: 'cloud' as const,
              remotePath: item.path,
              folderId: currentFolderId,
            },
          };
          tracks.push(track);
          currentLevelTracks.push(track);
        }
      }

      // Вызываем onChunk сразу после получения списка
      progress?.onChunk?.(currentLevelFolders, currentLevelTracks);

      // Теперь идем вглубь
      for (const child of childDirs) {
        await walk(child.remotePath, currentFolderId, child.id, false);
      }
    } catch (err) {
      console.error(`[${pluginId}] scan: failed to scan "${remotePath}"`, err);
      progress?.onError(currentFolderId, err);
      hasError = true;
    }

    if (!hasError) {
      progress?.onDone(currentFolderId);
    }
  };

  newFolderMap[startRemotePath] = startFolderId;
  await walk(startRemotePath, null, startFolderId, true);

  return {
    snapshot: { folders, tracks },
    newFolderMap,
    pathMap,
  };
}
