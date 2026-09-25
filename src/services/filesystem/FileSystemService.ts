// src/services/filesystem/FileSystemService.ts

import { get, set, del } from 'idb-keyval'
import type { FileEntry, PermissionMode } from './types'
import type { CollectedLibrary, Folder, LibraryTrack } from '@/types/library'
import { folderIdFromPath, trackIdFromPath, ROOT_FOLDER_ID } from '@/services/library/id'
import { parseTrackMetadata } from '@/services/metadata/parseTrackMetadata'

const HANDLE_KEY = 'player:directoryHandle'

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

  // --- Выбор папки ------------------------------------------------------

  async pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.supported) {
      throw new Error(
        'File System Access API не поддерживается. Используйте Chrome/Edge на десктопе.',
      )
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' })
      await this.saveHandle(handle)
      return handle
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null
      }
      throw err
    }
  }

  // --- Сохранение и восстановление хэндла -------------------------------

  async saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    try {
      await set(HANDLE_KEY, handle)
    } catch (err) {
      console.error('[FileSystemService] failed to save handle', err)
    }
  }

  async restoreHandle(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const handle = await get<FileSystemDirectoryHandle>(HANDLE_KEY)
      return handle ?? null
    } catch (err) {
      console.error('[FileSystemService] failed to restore handle', err)
      return null
    }
  }

  async clearHandle(): Promise<void> {
    await del(HANDLE_KEY)
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
      console.warn('[FileSystemService] permission request needs user gesture', err)
      return false
    }
  }

  // --- Обход папки: плоский список файлов ------------------------------

  /**
   * @deprecated Используй collectLibrary. Оставлено для тестов и обратной совместимости.
   */
  async collectAudioFiles(
    dirHandle: FileSystemDirectoryHandle,
    onProgress?: (count: number, path: string) => void,
  ): Promise<FileEntry[]> {
    const results: FileEntry[] = []

    const walk = async (handle: FileSystemDirectoryHandle, pathPrefix: string): Promise<void> => {
      const filePromises: Promise<FileEntry | null>[] = []
      const subdirs: { handle: FileSystemDirectoryHandle; path: string }[] = []

      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          if (this.isAudioFile(entry.name)) {
            filePromises.push(this.entryToFileEntry(entry, handle, pathPrefix))
          }
        } else {
          subdirs.push({
            handle: entry,
            path: pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name,
          })
        }
      }

      const files = await Promise.all(filePromises)
      for (const entry of files) {
        if (entry) {
          results.push(entry)
          onProgress?.(results.length, entry.path)
        }
      }

      await Promise.all(subdirs.map((sub) => walk(sub.handle, sub.path)))
    }

    await walk(dirHandle, '')
    return results
  }

  // --- Обход папки: нормализованная библиотека -------------------------

  /**
   * Рекурсивно обходит папку и возвращает нормализованную библиотеку:
   * плоские массивы folders и tracks со связями через id.
   */
  async collectLibrary(
    rootHandle: FileSystemDirectoryHandle,
    onProgress?: (folders: number, tracks: number) => void,
  ): Promise<CollectedLibrary> {
    const folders: Folder[] = []
    const tracks: LibraryTrack[] = []

    const walk = async (
      handle: FileSystemDirectoryHandle,
      parentId: string | null,
      path: string,
    ): Promise<Folder> => {
      const id = path === '' ? ROOT_FOLDER_ID : folderIdFromPath(path)

      // 1. Собираем файлы и подпапки
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

      fileEntries.sort((a, b) => a.name.localeCompare(b.name))
      dirEntries.sort((a, b) => a.name.localeCompare(b.name))

      // 2. Ищем обложку один раз на папку (если в ней есть треки)
      const coverFile = fileEntries.length > 0 ? await this.findCoverInDirectory(handle) : null

      // 3. Парсим треки параллельно. Promise.all сохраняет порядок,
      //    соответствующий fileEntries
      const localTracks = await Promise.all(
        fileEntries.map(async (fileHandle): Promise<LibraryTrack> => {
          const file = await fileHandle.getFile()
          const trackPath = path ? `${path}/${file.name}` : file.name
          const trackId = trackIdFromPath(trackPath)

          const metadata = await parseTrackMetadata(file, {
            folderName: path.split('/').pop() || undefined,
            rootFolderName: rootHandle.name,
            coverFile,
          })

          return {
            id: trackId,
            folderId: id,
            filename: file.name,
            path: trackPath,
            handle: fileHandle,
            // directoryHandle — та директория, в которой лежит файл.
            // Нужен для восстановления обложек при restore плеера.
            directoryHandle: handle,
            source: file,
            ...metadata,
          }
        }),
      )

      tracks.push(...localTracks)
      const trackIds = localTracks.map((t) => t.id)

      // 4. Рекурсивно обходим подпапки
      const childFolders = await Promise.all(
        dirEntries.map((dir) => {
          const childPath = path ? `${path}/${dir.name}` : dir.name
          return walk(dir.handle, id, childPath)
        }),
      )

      // 5. Считаем totalTracks: свои + во всех поддеревьях
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

  async countAudioFiles(dirHandle: FileSystemDirectoryHandle): Promise<number> {
    let count = 0

    const walk = async (handle: FileSystemDirectoryHandle): Promise<void> => {
      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && this.isAudioFile(entry.name)) {
          count++
        } else if (entry.kind === 'directory') {
          await walk(entry)
        }
      }
    }

    await walk(dirHandle)
    return count
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
      console.warn(`[FileSystemService] failed to read ${handle.name}`, err)
      return null
    }
  }

  async findCoverInDirectory(dirHandle: FileSystemDirectoryHandle): Promise<File | null> {
    const priority = ['folder.jpg', 'folder.png', 'cover.jpg', 'cover.png']
    const priorityIndex = new Map(priority.map((name, i) => [name, i]))
    let best: { handle: FileSystemFileHandle; rank: number } | null = null

    for await (const entry of dirHandle.values()) {
      if (entry.kind !== 'file') continue
      const lower = entry.name.toLowerCase()
      const rank = priorityIndex.get(lower)
      if (rank === undefined) continue
      if (!best || rank < best.rank) {
        best = { handle: entry, rank }
      }
      if (rank === 0) break
    }

    if (!best) return null
    try {
      return await best.handle.getFile()
    } catch (err) {
      console.warn(`[FileSystemService] failed to read cover ${best.handle.name}`, err)
      return null
    }
  }

  // --- Очистка ----------------------------------------------------------

  async forgetDirectory(): Promise<void> {
    await this.clearHandle()
  }
}

export const fileSystemService = FileSystemService.getInstance()
