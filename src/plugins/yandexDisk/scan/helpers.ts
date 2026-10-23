// src/plugins/yandexDisk/scan/helpers.ts

import type { PluginContext } from '../../types'
import type { Folder, LibraryTrack, TextFileRef } from '@/types/library'
import { folderIdFromPath, trackIdFromPath } from '@/services/library/id'
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import type { YandexResourceItem, IYandexService } from '../types'

export const ROOT_REMOTE_PATH = 'disk:/'

export function isTextFile(name: string): boolean {
  return name.toLowerCase().endsWith('.txt')
}

export function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

export interface PartitionedItems {
  subDirs: YandexResourceItem[]
  audioItems: YandexResourceItem[]
  textItems: YandexResourceItem[]
}

export function partitionItems(items: YandexResourceItem[]): PartitionedItems {
  const subDirs: YandexResourceItem[] = []
  const audioItems: YandexResourceItem[] = []
  const textItems: YandexResourceItem[] = []

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

export function buildTrack(
  folder: Folder,
  item: YandexResourceItem,
  sourceId: string,
  service: IYandexService,
): LibraryTrack {
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
    source: service.buildDownloadUrl(item.path),
    title: titleFromFilename(item.name),
    artist: '',
    album: folder.name ?? '',
    coverUrl: cachedCover,
    fileLocation: 'remote-only',
  }
}

export function buildTextFile(folder: Folder, item: YandexResourceItem): TextFileRef {
  const textPath = folder.path ? `${folder.path}/${item.name}` : item.name
  return {
    name: item.name,
    remotePath: item.path,
    path: textPath,
  }
}

export function ensureSubFolders(
  context: PluginContext,
  parent: Folder,
  subDirs: YandexResourceItem[],
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
        scanState: 'pending',
      }
      newFolders.push(childFolder)
    }
    childFolderIds.push(childId)
  }

  return { childFolderIds, newFolders }
}
