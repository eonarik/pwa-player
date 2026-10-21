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

/**
 * Рекурсивно сканирует папку и её подпапки.
 *
 * Возвращает `true`, если папка и всё её поддерево просканированы (`ready`),
 * иначе `false`. Используется как `LibrarySource.scanFolder`.
 *
 * Логика:
 * 1. Если папка уже `scanning` — не трогаем, возвращаем текущий `ready`.
 * 2. Если `scanStatus !== 'scanned'` (или `removeMissing === true`) —
 *    запрашиваем содержимое, мержим, помечаем `scanned`.
 * 3. Если `recursive: false` — обновляем `ready` по факту (папка без
 *    подпапок считается готовой).
 * 4. Если `recursive: true` — рекурсивно обходим детей параллельно
 *    (до 5 одновременно), агрегируем счётчики, помечаем `ready`,
 *    если все дети готовы.
 */
export async function scanFolderRecursive(
  deps: ScanFolderDeps,
  folderId: string,
  options: { recursive: boolean; removeMissing?: boolean },
): Promise<boolean> {
  const { context, sourceId, service } = deps

  const folder = context.writer.getFolder(folderId)
  if (!folder || !folder.remotePath) return false

  if (folder.scanStatus === 'scanning') return folder.ready ?? false

  const needScan = folder.scanStatus !== 'scanned' || options.removeMissing === true

  if (needScan) {
    context.writer.updateFolder(folderId, { scanStatus: 'scanning' })
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
    }
    context.writer.updateFolder(folderId, { scanStatus: 'scanned' })
  }

  if (!options.recursive) {
    const updated = context.writer.getFolder(folderId)
    const isReady = updated?.scanStatus === 'scanned' && (updated.childFolderIds.length ?? 0) === 0
    context.writer.updateFolder(folderId, { ready: isReady })
    return isReady
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
  const isReady = final.scanStatus === 'scanned' && allChildrenReady

  context.writer.updateFolder(folderId, {
    totalTrackCount: final.trackIds.length + childTrackTotal,
    totalTextFileCount: (final.textFiles?.length ?? 0) + childTextTotal,
    ready: isReady,
  })

  return isReady
}
