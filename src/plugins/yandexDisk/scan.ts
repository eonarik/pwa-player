// src/plugins/yandexDisk/scan.ts

import type { PluginSnapshot } from '../types';
import type { IYandexService } from './types';
import type { FolderId } from '@/types/ids';
import { newFolderId } from '@/types/ids';
import { guessMetadataFromFilename } from '@/utils/parseFilename';
import { mapWithConcurrency } from './concurrency';
import { compareStrings } from '@/utils/sort';
import { folderStatusService } from '@/services/folders/FolderStatusService';

export const ROOT_REMOTE_PATH = 'disk:/';

export function isTextFile(name: string): boolean {
  return name.toLowerCase().endsWith('.txt');
}

export interface ScanProgressCallback {
  onStart: (folderId: FolderId) => void;
  onDone: (folderId: FolderId) => void;
  onError: (folderId: FolderId, error: unknown) => void;
  onFolderDiscovered?: (folder: PluginSnapshot['folders'][number]) => void;
  onChunk?: (folders: PluginSnapshot['folders'], tracks: PluginSnapshot['tracks']) => void | Promise<void>;
}

export interface ScanAllOptions {
  recursive: boolean;
  skipScanned?: boolean;
  progress?: ScanProgressCallback;
  /** Имя стартовой папки (если известно) */
  startFolderName?: string;
  /** ID родителя стартовой папки (если известен) */
  startParentId?: FolderId | null;
}

export interface ScanAllResult {
  snapshot: PluginSnapshot;
  newFolderMap: Record<string, string>;
  pathMap: Record<string, string>;
}

function normalizeUrlPath(remotePath: string): string {
  return remotePath
    .replace(/^disk:\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

export async function scanAll(
  pluginId: string,
  service: IYandexService,
  folderMap: Record<string, string>,
  startFolderId: FolderId,
  startRemotePath: string = ROOT_REMOTE_PATH,
  options: ScanAllOptions,
): Promise<ScanAllResult> {
  const skipScanned = options.skipScanned !== false;

  const folders: PluginSnapshot['folders'] = [];
  const tracks: PluginSnapshot['tracks'] = [];

  const newFolderMap: Record<string, string> = { ...folderMap };
  const pathMap: Record<string, string> = {};
  const progress = options.progress;

  // Сразу создаём стартовую папку, чтобы в неё складывать файлы
  const fallbackName = startRemotePath.split('/').filter(Boolean).pop() || 'Корень';

  const startFolder: PluginSnapshot['folders'][number] = {
    id: startFolderId,
    parentId: options.startParentId ?? null,
    name: options.startFolderName || fallbackName,
    urlPath: normalizeUrlPath(startRemotePath),
    files: [],
  };
  folders.push(startFolder);

  let pendingFolders: PluginSnapshot['folders'] = [];
  let pendingTracks: PluginSnapshot['tracks'] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let chunkPromise = Promise.resolve();

  const flushChunks = async () => {
    if (pendingFolders.length === 0 && pendingTracks.length === 0) return;

    const toFlushFolders = pendingFolders;
    const toFlushTracks = pendingTracks;
    pendingFolders = [];
    pendingTracks = [];

    toFlushFolders.sort((a, b) => compareStrings(a.name, b.name));
    toFlushTracks.sort((a, b) => compareStrings(a.title, b.title));

    if (progress?.onChunk) {
      chunkPromise = chunkPromise.then(async () => {
        if (service.isCancelled?.()) return;
        try {
          await progress.onChunk!(toFlushFolders, toFlushTracks);
        } catch (err) {
          console.warn(`[${pluginId}] onChunk failed`, err);
        }
      });
      await chunkPromise;
    }
  };

  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushChunks();
    }, 1500);
  };

  const walk = async (remotePath: string, currentFolderId: FolderId): Promise<void> => {
    if (service.isCancelled?.()) return;

    pathMap[currentFolderId] = remotePath;
    progress?.onStart(currentFolderId);

    let hasError = false;
    const childDirs: Array<{ id: FolderId; name: string; remotePath: string }> = [];

    try {
      const response = await service.listResources(remotePath);
      const items = response._embedded?.items || response.items || [];

      const currentFolder = folders.find((f) => f.id === currentFolderId);

      for (const item of items) {
        if (item.type === 'dir') {
          const childPath = item.path;
          const existingId = newFolderMap[childPath];
          const childFolderId = existingId ? (existingId as FolderId) : newFolderId();
          newFolderMap[childPath] = childFolderId;

          const folder = {
            id: childFolderId,
            parentId: currentFolderId,
            name: item.name,
            urlPath: normalizeUrlPath(childPath),
            files: [],
          };
          folders.push(folder);
          pendingFolders.push(folder);
          pathMap[childFolderId] = childPath;

          if (skipScanned && folderStatusService.isScanned(childFolderId)) {
            continue;
          }

          progress?.onFolderDiscovered?.(folder);

          if (options.recursive) {
            childDirs.push({ id: childFolderId, name: item.name, remotePath: childPath });
          }
        } else if (item.type === 'file') {
          if (item.isAudio) {
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
            pendingTracks.push(track);
          } else {
            // Не аудио — складываем в файлы текущей папки
            if (currentFolder) {
              const dotIndex = item.name.lastIndexOf('.');
              const ext = dotIndex !== -1 ? item.name.slice(dotIndex).toLowerCase() : '';

              let fileUrl: string | undefined;
              if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
                try {
                  fileUrl = service.buildDownloadUrl(item.path);
                } catch {
                  fileUrl = undefined;
                }
              }

              if (!currentFolder.files) currentFolder.files = [];
              currentFolder.files.push({
                name: item.name,
                urlPath: normalizeUrlPath(item.path),
                ext,
                url: fileUrl,
              });
            }
          }
        }
      }

      scheduleFlush();

      if (options.recursive && childDirs.length > 0) {
        await mapWithConcurrency(
          childDirs,
          5,
          async (child) => {
            if (service.isCancelled?.()) return;
            await walk(child.remotePath, child.id);
          },
          { shouldStop: () => service.isCancelled?.() ?? false },
        );
      }
    } catch (err) {
      if (service.isCancelled?.()) return;
      console.error(`[${pluginId}] scan: failed to scan "${remotePath}"`, err);
      progress?.onError(currentFolderId, err);
      hasError = true;
    }

    if (!hasError && !service.isCancelled?.()) {
      progress?.onDone(currentFolderId);
    }
  };

  newFolderMap[startRemotePath] = startFolderId;
  await walk(startRemotePath, startFolderId);

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushChunks();
  await chunkPromise;

  folders.sort((a, b) => compareStrings(a.name, b.name));
  tracks.sort((a, b) => compareStrings(a.title, b.title));

  return {
    snapshot: { folders, tracks },
    newFolderMap,
    pathMap,
  };
}
