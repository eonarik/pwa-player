// src/plugins/yandexDisk/scan/root.ts

import type { Folder, LibraryTrack, TextFileRef } from '@/types/library'
import { folderIdFromPath } from '@/services/library/id'
import type { IYandexService } from '../types'
import { ROOT_REMOTE_PATH, partitionItems, buildTrack, buildTextFile } from './helpers'

/**
 * Загружает содержимое корневой папки Яндекс.Диска (`disk:/`).
 *
 * Возвращает массив папок (корень + прямые подпапки) и массив треков
 * (только файлы в корне). Подпапки помечаются `scanStatus: undefined`,
 * `ready: false` — их содержимое подгрузится фоновым сканированием.
 */
export async function loadRootContent(
  sourceId: string,
  rootFolderId: string,
  service: IYandexService,
): Promise<{
  folders: Folder[]
  tracks: LibraryTrack[]
}> {
  const response = await service.listResources(ROOT_REMOTE_PATH)

  const folders: Folder[] = []
  const tracks: LibraryTrack[] = []
  const childFolderIds: string[] = []
  const trackIds: string[] = []

  const { subDirs, audioItems, textItems } = partitionItems(
    response._embedded?.items || response.items || [],
  )

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

  for (const item of audioItems) {
    const track = buildTrack(rootFolder, item, sourceId, service)
    tracks.push(track)
    trackIds.push(track.id)
  }

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
