// src/plugins/yandexDisk/scan.ts

import type { PluginContext } from '../types'
import type { Folder, LibraryTrack, TextFileRef } from '@/types/library'
import { yandexDiskService } from './YandexDiskService'
import { yandexPersistenceService } from './persistence'
import { folderIdFromPath, trackIdFromPath } from '@/services/library/id'
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import type { LibraryWriter } from '../types'
import type { YandexItem } from './types'
import { toPersisted } from './persist'
import { PLUGIN_ID } from './constants'

const ROOT_REMOTE_PATH = 'disk:/'

// --- Хелперы ----------------------------------------------------------

function isTextFile(name: string): boolean {
  return name.toLowerCase().endsWith('.txt')
}

/** Имя файла без расширения — как title для трека с Диска (без ID3-тегов). */
function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

interface PartitionedItems {
  subDirs: YandexItem[]
  audioItems: YandexItem[]
  textItems: YandexItem[]
}

function partitionItems(items: YandexItem[]): PartitionedItems {
  const subDirs: YandexItem[] = []
  const audioItems: YandexItem[] = []
  const textItems: YandexItem[] = []

  for (const item of items) {
    if (item.type === 'dir') {
      subDirs.push(item)
    } else if (item.isAudio) {
      audioItems.push(item)
    } else if (item.type === 'file' && isTextFile(item.name)) {
      textItems.push(item)
    }
  }

  return { subDirs, audioItems, textItems }
}

// --- Построение ------------------------------------------------------

/**
 * sourceId — всегда чистый id плагина ('yandex').
 * trackIdFromPath(sourceId, ...) даёт 'track:yandex:path/song.mp3'.
 * track.pluginId === sourceId.
 */
function buildTrack(folder: Folder, item: YandexItem, sourceId: string): LibraryTrack {
  const trackPath = folder.path ? `${folder.path}/${item.name}` : item.name
  const trackId = trackIdFromPath(sourceId, trackPath)
  const cachedCover = metadataPersistenceService.get(trackId)?.coverUrl ?? undefined

  return {
    id: trackId,
    pluginId: sourceId,
    folderId: folder.id,
    filename: item.name,
    path: trackPath,
    remotePath: item.path,
    source: yandexDiskService.buildDownloadUrl(item.path),
    title: titleFromFilename(item.name),
    artist: '',
    album: folder.name ?? '',
    coverUrl: cachedCover,
  }
}

function buildTextFile(folder: Folder, item: YandexItem): TextFileRef {
  const textPath = folder.path ? `${folder.path}/${item.name}` : item.name
  return {
    name: item.name,
    remotePath: item.path,
    path: textPath,
  }
}

/**
 * Создаёт недостающие подпапки и возвращает полный список childFolderIds.
 * Существующие папки не трогает.
 *
 * sourceId — 'yandex'. Используется и для folderIdFromPath, и для Folder.source.
 */
function ensureSubFolders(
  context: PluginContext,
  parent: Folder,
  subDirs: YandexItem[],
  sourceId: string,
): { childFolderIds: string[]; newFolders: Folder[] } {
  const childFolderIds: string[] = []
  const newFolders: Folder[] = []

  for (const item of subDirs) {
    const childPath = parent.path ? `${parent.path}/${item.name}` : item.name
    const childId = folderIdFromPath(sourceId, childPath)

    let childFolder = context.writer.getFolder(childId)
    if (!childFolder) {
      childFolder = {
        id: childId,
        name: item.name,
        parentId: parent.id,
        path: childPath,
        remotePath: item.path,
        childFolderIds: [],
        trackIds: [],
        totalTrackCount: 0,
        totalTextFileCount: 0,
        source: sourceId,
        scanStatus: undefined,
        ready: false,
      }
      newFolders.push(childFolder)
    }
    childFolderIds.push(childId)
  }

  return { childFolderIds, newFolders }
}

// --- Сканирование одной папки (без рекурсии) -------------------------

/**
 * Обходит одну папку на Диске и мержит её содержимое с библиотекой.
 *
 * Правила:
 * - Треки из remoteItems → создаются (если новых нет) / обновляются.
 * - Треки, которых нет в remoteItems, но есть в библиотеке → удаляются,
 *   ЕСЛИ origin !== 'only-local'.
 * - only-local треки сохраняются всегда.
 * - Папки: создаются недостающие, удаляются отсутствующие на сервере
 *   (вместе с поддеревом — рекурсивно).
 * - textFiles заменяются целиком.
 *
 * sourceId — 'yandex' (PLUGIN_ID). НЕ folderId!
 */
export function mergeFolderContent(
  context: PluginContext,
  folder: Folder,
  items: YandexItem[],
  removeMissing: boolean,
  sourceId: string,
): void {
  const { subDirs, audioItems, textItems } = partitionItems(items)

  // 1. Треки: построить
  const remoteTrackIds: string[] = []
  const newTracks: LibraryTrack[] = []

  for (const item of audioItems) {
    const track = buildTrack(folder, item, sourceId)
    if (!context.writer.getTrack(track.id)) {
      newTracks.push(track)
    }
    remoteTrackIds.push(track.id)
  }

  // 2. Текстовые файлы
  const textFiles: TextFileRef[] = textItems.map((item) => buildTextFile(folder, item))

  // 3. Подпапки
  const { childFolderIds, newFolders } = ensureSubFolders(context, folder, subDirs, sourceId)

  // 4. Записать новые треки / папки
  if (newTracks.length > 0) context.writer.addTracks(newTracks, sourceId)
  if (newFolders.length > 0) context.writer.addFolders(newFolders, sourceId)

  // 5. Сформировать финальный список треков папки
  const onlyLocalIds = folder.trackIds.filter((id) => {
    const t = context.writer.getTrack(id)
    return t?.origin === 'only-local'
  })

  let finalTrackIds: string[]
  if (removeMissing) {
    // Удаляем всё, чего нет на сервере, кроме only-local
    const currentRemoteIds = folder.trackIds.filter((id) => {
      const t = context.writer.getTrack(id)
      return t && t.origin !== 'only-local'
    })
    const removed = currentRemoteIds.filter((id) => !remoteTrackIds.includes(id))
    if (removed.length > 0) {
      context.writer.removeTracks(removed)
    }
    finalTrackIds = [...remoteTrackIds, ...onlyLocalIds]
  } else {
    // Добавляем только новые, не трогая существующие
    const existing = new Set(folder.trackIds)
    const added = remoteTrackIds.filter((id) => !existing.has(id))
    finalTrackIds = Array.from(new Set([...folder.trackIds, ...added]))
  }

  // 6. Удалить папки, которых больше нет на сервере (вместе с поддеревом)
  if (removeMissing) {
    const removedFolderIds = folder.childFolderIds.filter((id) => !childFolderIds.includes(id))
    for (const removedId of removedFolderIds) {
      removeSubtree(context, removedId)
    }
  }

  // 7. Обновить папку
  context.writer.updateFolder(folder.id, {
    childFolderIds: removeMissing
      ? childFolderIds
      : Array.from(new Set([...folder.childFolderIds, ...childFolderIds])),
    trackIds: finalTrackIds,
    textFiles,
    totalTextFileCount: textFiles.length,
  })
}

/**
 * Рекурсивно удаляет папку и всё её поддерево:
 * - все вложенные папки и треки,
 * - ссылки из parentFolder.childFolderIds (родитель уже удаляется снаружи,
 *   но если функция вызывается для промежуточной — не повредит).
 */
export function removeSubtree(context: PluginContext, folderId: string): void {
  const folder = context.writer.getFolder(folderId)
  if (!folder) return

  const tracksToRemove: string[] = []
  const foldersToRemove: string[] = []

  const walk = (id: string): void => {
    const f = context.writer.getFolder(id)
    if (!f) return

    for (const trackId of f.trackIds) {
      tracksToRemove.push(trackId)
    }
    foldersToRemove.push(f.id)

    for (const childId of f.childFolderIds) {
      walk(childId)
    }
  }

  walk(folderId)

  if (tracksToRemove.length > 0) context.writer.removeTracks(tracksToRemove)
  if (foldersToRemove.length > 0) context.writer.removeFolders(foldersToRemove)
}

// --- Рекурсивный обход (refresh) -------------------------------------

/**
 * Рекурсивно обходит папку и всё её поддерево, обновляя содержимое.
 * Возвращает количество треков и файлов в поддереве.
 *
 * sourceId — 'yandex'.
 */
export async function refreshSubtree(
  context: PluginContext,
  rootFolder: Folder,
  sourceId: string,
): Promise<{ tracks: number; files: number }> {
  const walk = async (folder: Folder): Promise<{ tracks: number; files: number }> => {
    if (!folder.remotePath) return { tracks: 0, files: 0 }

    let response
    try {
      response = await yandexDiskService.listResources(folder.remotePath)
    } catch (err) {
      console.warn(
        `[yandex] skip folder "${folder.path}": ${err instanceof Error ? err.message : err}`,
      )
      return { tracks: 0, files: 0 }
    }

    mergeFolderContent(context, folder, response.items, true, sourceId)

    const updated = context.writer.getFolder(folder.id)
    if (!updated) return { tracks: 0, files: 0 }

    const childFolders = updated.childFolderIds
      .map((id) => context.writer.getFolder(id))
      .filter((f): f is Folder => Boolean(f))

    // Параллельно, но не более CONCURRENCY воркеров
    const CONCURRENCY = 5
    let cursor = 0
    const childResults: Array<{ tracks: number; files: number }> = Array.from({
      length: childFolders.length,
    })

    const worker = async (): Promise<void> => {
      while (cursor < childFolders.length) {
        const i = cursor++
        const child = childFolders[i]!
        childResults[i] = await walk(child)
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, childFolders.length) }, () => worker()),
    )

    let childTracks = 0
    let childFiles = 0
    for (const r of childResults) {
      childTracks += r.tracks
      childFiles += r.files
    }

    const totalTracks = updated.trackIds.length + childTracks
    const totalFiles = (updated.textFiles?.length ?? 0) + childFiles

    context.writer.updateFolder(folder.id, {
      totalTrackCount: totalTracks,
      totalTextFileCount: totalFiles,
      scanStatus: 'scanned',
      ready: true,
    })

    return { tracks: totalTracks, files: totalFiles }
  }

  return walk(rootFolder)
}

// --- Загрузка корня --------------------------------------------------

/**
 * Загружает корень Диска.
 * НЕ использует merge (нет существующей папки), строит всё с нуля.
 *
 * sourceId — 'yandex'.
 * rootFolderId — 'folder:yandex:__root__'.
 */
export async function loadRootContent(
  sourceId: string,
  rootFolderId: string,
): Promise<{
  folders: Folder[]
  tracks: LibraryTrack[]
}> {
  const response = await yandexDiskService.listResources(ROOT_REMOTE_PATH)

  const folders: Folder[] = []
  const tracks: LibraryTrack[] = []
  const childFolderIds: string[] = []
  const trackIds: string[] = []

  const { subDirs, audioItems, textItems } = partitionItems(response.items)

  // Корневая папка
  const rootFolder: Folder = {
    id: rootFolderId,
    name: 'Яндекс.Диск',
    parentId: null,
    path: '',
    remotePath: ROOT_REMOTE_PATH,
    childFolderIds: [],
    trackIds: [],
    totalTrackCount: 0,
    totalTextFileCount: 0,
    source: sourceId,
    scanStatus: 'scanned',
    ready: false,
  }

  // Подпапки первого уровня
  for (const item of subDirs) {
    const childPath = item.name
    const childId = folderIdFromPath(sourceId, childPath)
    folders.push({
      id: childId,
      name: item.name,
      parentId: rootFolderId,
      path: childPath,
      remotePath: item.path,
      childFolderIds: [],
      trackIds: [],
      totalTrackCount: 0,
      totalTextFileCount: 0,
      source: sourceId,
      scanStatus: undefined,
      ready: false,
    })
    childFolderIds.push(childId)
  }

  // Треки в корне
  for (const item of audioItems) {
    const track = buildTrack(rootFolder, item, sourceId)
    tracks.push(track)
    trackIds.push(track.id)
  }

  // .txt в корне
  const textFiles: TextFileRef[] = textItems.map((item) => buildTextFile(rootFolder, item))

  rootFolder.childFolderIds = childFolderIds
  rootFolder.trackIds = trackIds
  rootFolder.totalTrackCount = trackIds.length
  rootFolder.totalTextFileCount = textFiles.length
  rootFolder.textFiles = textFiles

  return {
    folders: [rootFolder, ...folders],
    tracks,
  }
}

// --- Фоновый обход ---------------------------------------------------

/**
 * Если есть «неготовые» папки — обходит всё дерево рекурсивно.
 * Вызывается после load / restoreFromCache.
 *
 * sourceId — 'yandex'.
 */
export async function backgroundScan(context: PluginContext, sourceId: string): Promise<void> {
  const allFolders = context.writer.getFoldersBySource(sourceId)
  const unready = allFolders.filter((f) => f.ready !== true)

  console.info('[yandex] background scan check:', {
    total: allFolders.length,
    unready: unready.length,
  })

  if (unready.length === 0) return

  const rootFolder = allFolders.find((f) => f.parentId === null)
  if (!rootFolder) return

  console.info('[yandex] background scan: start')
  await refreshSubtree(context, rootFolder, sourceId)
  console.info('[yandex] background scan: complete')

  await yandexPersistenceService.save(toPersisted(currentLibraryFromWriter(context, sourceId)))
}

// --- Поиск ближайшей существующей папки ------------------------------

export function findNearestFolder(
  writer: LibraryWriter,
  sourceId: string,
  relativePath: string,
): Folder | null {
  const segments = relativePath.split('/').filter(Boolean)
  segments.pop()

  const folders = writer.getFoldersBySource(sourceId)

  while (segments.length > 0) {
    const candidatePath = segments.join('/')
    const folder = folders.find((f) => f.path === candidatePath)
    if (folder) return folder
    segments.pop()
  }

  return folders.find((f) => f.parentId === null) ?? null
}

// --- Вспомогательное -------------------------------------------------

/**
 * Собирает CollectedLibrary из текущего состояния стора для persistence.
 * Используется в backgroundScan / refreshFolder / saveCache.
 *
 * sourceId — 'yandex'.
 */
export function currentLibraryFromWriter(
  context: PluginContext,
  sourceId: string,
): {
  folders: Folder[]
  tracks: LibraryTrack[]
  rootFolderId: string
  rootFolderName: string
} {
  const folders = context.writer.getFoldersBySource(sourceId)
  const tracks = context.writer.getTracksBySource(sourceId)
  return {
    folders,
    tracks,
    rootFolderId: folders.find((f) => f.parentId === null)?.id ?? '',
    rootFolderName: 'Яндекс.Диск',
  }
}

// Явный реэкспорт, чтобы index.ts мог импортировать PLUGIN_ID не из constants
// (на случай, если кто-то предпочтёт локальный импорт).
export { PLUGIN_ID }
