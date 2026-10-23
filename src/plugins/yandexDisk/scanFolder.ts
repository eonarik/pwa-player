// src/plugins/yandexDisk/scanFolder.ts

import type { PluginContext } from '../types'
import type { Folder } from '@/types/library'
import { mergeFolderContent } from './scan'
import { mapWithConcurrency } from './concurrency'
import type { IYandexService } from './types'

const YANDEX_CONCURRENCY = 5

export interface ScanFolderDeps {
  context: PluginContext
  sourceId: string
  service: IYandexService
}

export async function scanFolderRecursive(
  deps: ScanFolderDeps,
  folderId: string,
  options: { recursive: boolean; removeMissing?: boolean },
): Promise<boolean> {
  const { context, sourceId, service } = deps

  const folder = context.writer.getFolder(folderId)
  if (!folder || !folder.remotePath) return false

  const currentState = folder.scanState ?? 'pending'

  if (currentState === 'scanning') return false

  const needScan = currentState !== 'scanned' || options.removeMissing === true

  if (needScan) {
    context.writer.updateFolder(folderId, { scanState: 'scanning' })
    try {
      const response = await service.listResources(folder.remotePath)
      mergeFolderContent(
        context,
        folder,
        response._embedded?.items || response.items || [],
        options.removeMissing === true,
        sourceId,
        service,
      )
    } catch (err) {
      console.warn(`[${sourceId}] scan failed for "${folder.path}":`, err)
      context.writer.updateFolder(folderId, { scanState: 'error' })
      return false
    }
    context.writer.updateFolder(folderId, { scanState: 'scanned' })
  }

  if (!options.recursive) {
    const updated = context.writer.getFolder(folderId)
    return updated?.scanState === 'scanned' && (updated.childFolderIds.length ?? 0) === 0
  }

  const updated = context.writer.getFolder(folderId)
  if (!updated) return false

  const childFolders = updated.childFolderIds
    .map((fid) => context.writer.getFolder(fid))
    .filter((f): f is Folder => Boolean(f))

  const isCancelled = (): boolean => Boolean(service.isCancelled?.())

  const childReady = await mapWithConcurrency(
    childFolders,
    YANDEX_CONCURRENCY,
    (child) => scanFolderRecursive(deps, child.id, options),
    { shouldStop: isCancelled },
  )

  const childTrackTotal = childFolders.reduce((sum, child) => {
    const c = context.writer.getFolder(child.id)
    return sum + (c?.totalTrackCount ?? 0)
  }, 0)

  const childTextTotal = childFolders.reduce((sum, child) => {
    const c = context.writer.getFolder(child.id)
    return sum + (c?.totalTextFileCount ?? 0)
  }, 0)

  const final = context.writer.getFolder(folderId)
  if (!final) return false

  const allChildrenReady = childReady.every((r) => r === true)
  const isReady = final.scanState === 'scanned' && allChildrenReady

  context.writer.updateFolder(folderId, {
    totalTrackCount: final.trackIds.length + childTrackTotal,
    totalTextFileCount: (final.textFiles?.length ?? 0) + childTextTotal,
  })

  return isReady
}
