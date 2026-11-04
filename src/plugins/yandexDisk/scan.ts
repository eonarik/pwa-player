// src/plugins/yandexDisk/scan.ts

import type { PluginSnapshot } from '../types';
import type { IYandexService } from './types';
import type { FolderId } from '@/types/ids';
import { newFolderId } from '@/types/ids';
import { guessMetadataFromFilename } from '@/utils/parseFilename';
import { mapWithConcurrency } from './concurrency';
import { compareStrings } from '@/utils/sort';
import { telemetry } from '@/services/telemetry';

export const ROOT_REMOTE_PATH = '/';

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
  startFolderName?: string;
  startParentId?: FolderId | null;
  isFolderScanned?: (folderId: FolderId) => boolean;
}

export interface ScanAllResult {
  snapshot: PluginSnapshot;
  newFolderMap: Record<string, string>;
  pathMap: Record<string, string>;
}

/**
 * Абсолютный путь для запросов к API (всегда с ведущим слэшем).
 * '/' -> '/', 'Music' -> '/Music', 'disk:/Music' -> '/Music'.
 */
export function toRemotePath(p: string): string {
  if (!p) return '/';
  let path = p.replace(/^disk:\/?/, '/');
  if (!path.startsWith('/')) path = '/' + path;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

/**
 * Относительный путь для UI/роутера/library (без ведущего слэша).
 * '/' -> '', '/Music' -> 'Music', 'disk:/Music' -> 'Music'.
 */
export function toUrlPath(p: string): string {
  const abs = toRemotePath(p);
  return abs === '/' ? '' : abs.slice(1);
}

export async function scanAll(
  pluginId: string,
  service: IYandexService,
  pathMapIncoming: Record<string, string>,
  startFolderId: FolderId,
  startRemotePath: string = ROOT_REMOTE_PATH,
  options: ScanAllOptions,
): Promise<ScanAllResult> {
  const skipScanned = options.skipScanned !== false;
  const scanId = crypto.randomUUID();
  const scanStartTs = performance.now();
  const normalizedStartRemote = toRemotePath(startRemotePath);

  telemetry.event('scan.start', {
    scanId,
    pluginId,
    mode: skipScanned ? 'resume' : 'force',
    recursive: options.recursive,
  });

  const folders: PluginSnapshot['folders'] = [];
  const tracks: PluginSnapshot['tracks'] = [];

  const folderMap: Record<string, string> = {};
  for (const [id, path] of Object.entries(pathMapIncoming)) {
    if (path) {
      folderMap[toRemotePath(path)] = id;
    }
  }

  const newFolderMap: Record<string, string> = { ...folderMap };
  const pathMap: Record<string, string> = {};
  const progress = options.progress;

  const fallbackName = normalizedStartRemote.split('/').filter(Boolean).pop() || 'Корень';
  const startFolder: PluginSnapshot['folders'][number] = {
    id: startFolderId,
    parentId: options.startParentId ?? null,
    name: options.startFolderName || fallbackName,
    urlPath: toUrlPath(normalizedStartRemote),
    files: [],
  };
  folders.push(startFolder);

  let pendingFolders: PluginSnapshot['folders'] = [];
  let pendingTracks: PluginSnapshot['tracks'] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let chunkPromise = Promise.resolve();
  let lastChunkTs = performance.now();

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
          telemetry.event('scan.chunk', {
            scanId,
            folders: toFlushFolders.length,
            tracks: toFlushTracks.length,
            ms: Math.round(performance.now() - lastChunkTs),
          });
          lastChunkTs = performance.now();
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

    const normalizedRemote = toRemotePath(remotePath);
    pathMap[currentFolderId] = normalizedRemote;
    progress?.onStart(currentFolderId);

    let hasError = false;
    const childDirs: Array<{ id: FolderId; name: string; remotePath: string }> = [];

    const currentFolder = folders.find((f) => f.id === currentFolderId);

    try {
      const response = await service.listResources(normalizedRemote);
      const items = response._embedded?.items || response.items || [];

      for (const item of items) {
        if (item.type === 'dir') {
          const childRemote = toRemotePath(item.path);
          const childUrl = toUrlPath(childRemote);

          const existingId = newFolderMap[childRemote];
          const childFolderId = existingId ? (existingId as FolderId) : newFolderId();
          newFolderMap[childRemote] = childFolderId;

          const folder = {
            id: childFolderId,
            parentId: currentFolderId,
            name: item.name,
            urlPath: childUrl,
            files: [],
          };
          folders.push(folder);
          pendingFolders.push(folder);
          pathMap[childFolderId] = childRemote;

          if (skipScanned && options.isFolderScanned?.(childFolderId)) {
            continue;
          }

          progress?.onFolderDiscovered?.(folder);

          if (options.recursive) {
            childDirs.push({ id: childFolderId, name: item.name, remotePath: childRemote });
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
                remotePath: toRemotePath(item.path),
                folderId: currentFolderId,
              },
            };
            tracks.push(track);
            pendingTracks.push(track);
          } else {
            const isHidden = item.name.startsWith('.') && item.name.indexOf('.', 1) !== -1;
            if (currentFolder && !isHidden) {
              const dotIndex = item.name.lastIndexOf('.');
              const ext = dotIndex !== -1 ? item.name.slice(dotIndex).toLowerCase() : '';

              let fileUrl: string | undefined;
              if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
                try {
                  fileUrl = service.buildDownloadUrl(toRemotePath(item.path));
                } catch {
                  fileUrl = undefined;
                }
              }

              if (!currentFolder.files) currentFolder.files = [];
              currentFolder.files.push({
                name: item.name,
                urlPath: toUrlPath(item.path),
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

      if (currentFolder) {
        currentFolder.scanState = 'error';
      }

      telemetry.event('scan.error', {
        scanId,
        msg: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
      });
    }

    if (!hasError && !service.isCancelled?.()) {
      progress?.onDone(currentFolderId);
    }
  };

  newFolderMap[normalizedStartRemote] = startFolderId;

  await walk(normalizedStartRemote, startFolderId);

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushChunks();
  await chunkPromise;

  folders.sort((a, b) => compareStrings(a.name, b.name));
  tracks.sort((a, b) => compareStrings(a.title, b.title));

  telemetry.event('scan.done', {
    scanId,
    ms: Math.round(performance.now() - scanStartTs),
    folders: folders.length,
    tracks: tracks.length,
  });

  return {
    snapshot: { folders, tracks },
    newFolderMap,
    pathMap,
  };
}
