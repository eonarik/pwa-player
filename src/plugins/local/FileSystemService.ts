// src/plugins/local/FileSystemService.ts

import { get, set, del } from 'idb-keyval';
import type { PluginSnapshot, PluginTrackPayload, PluginFolderPayload, TextFileRef } from '../types';
import { newFolderId } from '@/types/ids';
import type { FolderId } from '@/types/ids';
import { guessMetadataFromFilename } from '@/utils/parseFilename';
import { compareStrings } from '@/utils/sort';
import { findCoverInDirectory } from '@/services/covers/findCoverInDirectory';
import { isAudioFile } from '@/shared/audioExtensions';

const HANDLES_KEY = 'player:directoryHandles';

export type PermissionMode = 'read' | 'readwrite';

export class FileSystemService {
  private static instance: FileSystemService | null = null;

  static getInstance(): FileSystemService {
    if (!FileSystemService.instance) {
      FileSystemService.instance = new FileSystemService();
    }
    return FileSystemService.instance;
  }

  get supported(): boolean {
    return 'showDirectoryPicker' in window;
  }

  async getHandles(): Promise<FileSystemDirectoryHandle[]> {
    try {
      const handles = await get<FileSystemDirectoryHandle[]>(HANDLES_KEY);
      return handles ?? [];
    } catch (err) {
      console.error('[local-plugin] failed to get handles', err);
      return [];
    }
  }

  async saveHandles(handles: FileSystemDirectoryHandle[]): Promise<void> {
    try {
      await set(HANDLES_KEY, handles);
    } catch (err) {
      console.error('[local-plugin] failed to save handles', err);
    }
  }

  async pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.supported) {
      throw new Error('File System Access API не поддерживается. Используйте Chrome/Edge на десктопе.');
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      return handle;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  async addHandle(handle: FileSystemDirectoryHandle): Promise<boolean> {
    const handles = await this.getHandles();
    const existing = handles.findIndex((h) => h.name === handle.name);
    if (existing !== -1) {
      return false;
    }
    handles.push(handle);
    await this.saveHandles(handles);
    return true;
  }

  async removeHandle(name: string): Promise<void> {
    const handles = await this.getHandles();
    const filtered = handles.filter((h) => h.name !== name);
    await this.saveHandles(filtered);
  }

  async clearHandles(): Promise<void> {
    await del(HANDLES_KEY);
  }

  async verifyPermission(handle: FileSystemDirectoryHandle, mode: PermissionMode = 'read'): Promise<boolean> {
    const options: FileSystemHandlePermissionDescriptor = { mode };

    if ((await handle.queryPermission(options)) === 'granted') {
      return true;
    }

    try {
      const result = await handle.requestPermission(options);
      return result === 'granted';
    } catch (err) {
      console.warn('[local-plugin] permission request needs user gesture', err);
      return false;
    }
  }

  async collectLibrary(
    rootHandle: FileSystemDirectoryHandle,
    rootFolderId: FolderId,
    folderMap: Record<string, string>,
    onProgress?: (folders: number, tracks: number) => void,
  ): Promise<{ snapshot: PluginSnapshot; newFolderMap: Record<string, string> }> {
    const folders: PluginFolderPayload[] = [];
    const tracks: PluginTrackPayload[] = [];
    const newFolderMap: Record<string, string> = { ...folderMap };

    const walk = async (
      handle: FileSystemDirectoryHandle,
      parentId: FolderId | null,
      path: string,
    ): Promise<FolderId> => {
      const existingId = newFolderMap[path];
      const folderId: FolderId = existingId ? (existingId as FolderId) : path === '' ? rootFolderId : newFolderId();
      newFolderMap[path] = folderId;

      const fileEntries: FileSystemFileHandle[] = [];
      const dirEntries: { handle: FileSystemDirectoryHandle; name: string }[] = [];

      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          if (isAudioFile(entry.name)) {
            fileEntries.push(entry);
          }
        } else {
          dirEntries.push({ handle: entry, name: entry.name });
        }
      }

      fileEntries.sort((a, b) => compareStrings(a.name, b.name));
      dirEntries.sort((a, b) => compareStrings(a.name, b.name));

      const coverFile = fileEntries.length > 0 ? await findCoverInDirectory(handle) : null;

      folders.push({
        id: folderId,
        parentId,
        name: handle.name,
        urlPath: path,
      });

      for (const fileHandle of fileEntries) {
        const file = await fileHandle.getFile();
        const parentFolder = path.split('/').filter(Boolean).pop();
        const guessed = guessMetadataFromFilename(file.name, parentFolder);
        const coverUrl = coverFile ? URL.createObjectURL(coverFile) : null;

        // ЛОГИРУЕМ КАЖДЫЙ НАЙДЕННЫЙ ТРЕК

        tracks.push({
          artist: guessed.artist,
          title: guessed.title,
          album: '',
          coverUrl,
          duration: undefined,
          codec: undefined,
          hasId3Tags: false,
          source: {
            pluginId: 'local',
            priority: 10,
            kind: 'local',
            handle: fileHandle,
            folderId,
          },
        });
      }

      for (const dir of dirEntries) {
        const childPath = path ? `${path}/${dir.name}` : dir.name;
        await walk(dir.handle, folderId, childPath);
      }

      onProgress?.(folders.length, tracks.length);

      return folderId;
    };

    await walk(rootHandle, null, '');

    // ЛОГИРУЕМ ИТОГ

    return {
      snapshot: { folders, tracks },
      newFolderMap,
    };
  }

  async getTextFiles(folderHandle: FileSystemDirectoryHandle): Promise<TextFileRef[]> {
    const result: TextFileRef[] = [];

    for await (const entry of folderHandle.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.txt')) {
        result.push({
          name: entry.name,
          remotePath: '',
          path: entry.name,
        });
      }
    }

    return result;
  }

  async forgetDirectory(): Promise<void> {
    await this.clearHandles();
  }
}

export const fileSystemService = FileSystemService.getInstance();
