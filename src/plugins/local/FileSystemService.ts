// src/plugins/local/FileSystemService.ts

import { get, set, del } from 'idb-keyval'
import type { FileEntry, PermissionMode } from './fsTypes'
import type { CollectedLibrary, Folder, LibraryTrack } from '@/types/library'
import { folderIdFromPath, trackIdFromPath } from '@/services/library/id'
import { parseTrackMetadata } from '@/services/metadata/parseTrackMetadata'
import { compareStrings } from '@/utils/sort'
import { findCoverInDirectory } from '@/services/covers/findCoverInDirectory'

const HANDLES_KEY = 'player:directoryHandles'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.wma'])

export class FileSystemService {
  private static instance: FileSystemService | null = null

  static getInstance(): FileSystemService {
    if (!FileSystemService.instance) {
      FileSystemService.instance = new FileSystemService()
    }
    return FileSystemService.instance
  }

  get supported(): boolean {
    return 'showDirectoryPicker' in window
  }

  // --- Хэндлы ----------------------------------------------------------

  async getHandles(): Promise<FileSystemDirectoryHandle[]> {
    try {
      const handles = await get<FileSystemDirectoryHandle[]>(HANDLES_KEY)
      return handles ?? []
    } catch (err) {
      console.error('[local-plugin] failed to get handles', err)
      return []
    }
  }

  async saveHandles(handles: FileSystemDirectoryHandle[]): Promise<void> {
    try {
      await set(HANDLES_KEY, handles)
    } catch (err) {
      console.error('[local-plugin] failed to save handles', err)
    }
  }

  async pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.supported) {
      throw new Error(
        'File System Access API не поддерживается. Используйте Chrome/Edge на десктопе.',
      )
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' })
      return handle
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null
      }
      throw err
    }
  }

  async addHandle(handle: FileSystemDirectoryHandle): Promise<boolean> {
    const handles = await this.getHandles()
    const existing = handles.findIndex((h) => h.name === handle.name)
    if (existing !== -1) {
      return false // уже есть
    }
    handles.push(handle)
    await this.saveHandles(handles)
    return true
  }

  async removeHandle(name: string): Promise<void> {
    const handles = await this.getHandles()
    const filtered = handles.filter((h) => h.name !== name)
    await this.saveHandles(filtered)
  }

  async clearHandles(): Promise<void> {
    await del(HANDLES_KEY)
  }

  // --- Права доступа ----------------------------------------------------

  async verifyPermission(
    handle: FileSystemDirectoryHandle,
    mode: PermissionMode = 'read',
  ): Promise<boolean> {
    const options: FileSystemHandlePermissionDescriptor = { mode }

    if ((await handle.queryPermission(options)) === 'granted') {
      return true
    }

    try {
      const result = await handle.requestPermission(options)
      return result === 'granted'
    } catch (err) {
      console.warn('[local-plugin] permission request needs user gesture', err)
      return false
    }
  }

  // --- Обход папки: нормализованная библиотека -------------------------

  /**
   * Рекурсивно обходит папку и возвращает нормализованную библиотеку:
   * плоские массивы folders и tracks со связями через id.
   *
   * rootId — уникальный идентификатор корня (например, 'local:Music').
   */
  async collectLibrary(
    rootHandle: FileSystemDirectoryHandle,
    rootId: string,
    onProgress?: (folders: number, tracks: number) => void,
  ): Promise<CollectedLibrary> {
    const folders: Folder[] = []
    const tracks: LibraryTrack[] = []

    const walk = async (
      handle: FileSystemDirectoryHandle,
      parentId: string | null,
      path: string,
    ): Promise<Folder> => {
      const id = folderIdFromPath(rootId, path)

      const fileEntries: FileSystemFileHandle[] = []
      const dirEntries: { handle: FileSystemDirectoryHandle; name: string }[] = []

      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          if (this.isAudioFile(entry.name)) {
            fileEntries.push(entry)
          }
        } else {
          dirEntries.push({ handle: entry, name: entry.name })
        }
      }

      fileEntries.sort((a, b) => compareStrings(a.name, b.name))
      dirEntries.sort((a, b) => compareStrings(a.name, b.name))

      const coverFile = fileEntries.length > 0 ? await findCoverInDirectory(handle) : null

      const localTracks = await Promise.all(
        fileEntries.map(async (fileHandle): Promise<LibraryTrack> => {
          const file = await fileHandle.getFile()
          const trackPath = path ? `${path}/${file.name}` : file.name
          const trackId = trackIdFromPath(rootId, trackPath)

          const metadata = await parseTrackMetadata(file, {
            folderName: path.split('/').pop() || undefined,
            rootFolderName: rootHandle.name,
            coverFile,
          })

          return {
            id: trackId,
            pluginId: rootId,
            folderId: id,
            filename: file.name,
            path: trackPath,
            handle: fileHandle,
            directoryHandle: handle,
            source: file,
            ...metadata,
          }
        }),
      )

      tracks.push(...localTracks)
      const trackIds = localTracks.map((t) => t.id)

      const childFolders = await Promise.all(
        dirEntries.map((dir) => {
          const childPath = path ? `${path}/${dir.name}` : dir.name
          return walk(dir.handle, id, childPath)
        }),
      )

      const childTotal = childFolders.reduce((sum, f) => sum + f.totalTrackCount, 0)

      const folder: Folder = {
        id,
        name: handle.name,
        parentId,
        path,
        handle,
        childFolderIds: childFolders.map((f) => f.id),
        trackIds,
        totalTrackCount: trackIds.length + childTotal,
        source: rootId,
        scanStatus: 'scanned',
        ready: true,
      }
      folders.push(folder)

      onProgress?.(folders.length, tracks.length)

      return folder
    }

    const rootFolder = await walk(rootHandle, null, '')

    return {
      folders,
      tracks,
      rootFolderId: rootFolder.id,
      rootFolderName: rootHandle.name,
    }
  }

  // --- Хелперы ----------------------------------------------------------

  private isAudioFile(name: string): boolean {
    const dot = name.lastIndexOf('.')
    if (dot === -1) return false
    const ext = name.slice(dot).toLowerCase()
    return AUDIO_EXTENSIONS.has(ext)
  }

  private async entryToFileEntry(
    handle: FileSystemFileHandle,
    directoryHandle: FileSystemDirectoryHandle,
    pathPrefix: string,
  ): Promise<FileEntry | null> {
    try {
      const file = await handle.getFile()
      return {
        handle,
        directoryHandle,
        file,
        name: file.name,
        path: pathPrefix ? `${pathPrefix}/${file.name}` : file.name,
        size: file.size,
      }
    } catch (err) {
      console.warn(`[local-plugin] failed to read ${handle.name}`, err)
      return null
    }
  }

  async forgetDirectory(): Promise<void> {
    await this.clearHandles()
  }
}

export const fileSystemService = FileSystemService.getInstance()
