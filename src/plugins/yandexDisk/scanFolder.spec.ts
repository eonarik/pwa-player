// src/plugins/yandexDisk/scanFolder.spec.ts
// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, vi } from 'vitest'
import { scanFolderRecursive } from './scanFolder'
import type { PluginContext } from '../types'
import type { Folder } from '@/types/library'
import type { IYandexService } from './types'

function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: 'folder:yandex:Music',
    name: 'Music',
    parentId: null,
    path: 'Music',
    remotePath: 'disk:/Music',
    childFolderIds: [],
    trackIds: [],
    totalTrackCount: 0,
    source: 'yandex',
    scanStatus: undefined,
    ready: false,
    ...overrides,
  }
}

function makeContext(folders: Record<string, Folder>): PluginContext {
  return {
    writer: {
      getFolder: (id: string) => folders[id] ?? null,
      updateFolder: vi.fn((id: string, patch: Partial<Folder>) => {
        const f = folders[id]
        if (f) Object.assign(f, patch)
      }),
      getTrack: vi.fn(() => null),
      addTracks: vi.fn(),
      addFolders: vi.fn(),
      removeTracks: vi.fn(),
      removeFolders: vi.fn(),
      removeBySource: vi.fn(),
      updateTrackOrigin: vi.fn(),
      updateTrackSource: vi.fn(),
      updateTrackDuration: vi.fn(),
      updateTrackMetadata: vi.fn(),
      setLibrary: vi.fn(),
      getFoldersBySource: vi.fn(() => []),
      getTracksBySource: vi.fn(() => []),
      getCurrentFolderId: vi.fn(() => null),
      setCurrentFolder: vi.fn(),
    },
    showModal: vi.fn(),
    showToast: vi.fn(),
    storage: {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      clear: vi.fn(),
    },
    getDownloadDir: vi.fn(async () => null),
  } as unknown as PluginContext
}

function makeService(): IYandexService {
  return {
    listResources: vi.fn(async () => ({ path: 'disk:/Music', total: 0, items: [] })),
    buildDownloadUrl: vi.fn(() => ''),
    readTextFile: vi.fn(async () => null),
    writeTextFile: vi.fn(async () => ({ ok: true, modified: null })),
  }
}

describe('scanFolderRecursive', () => {
  it('возвращает false, если папки нет', async () => {
    const context = makeContext({})
    const result = await scanFolderRecursive(
      { context, sourceId: 'yandex', service: makeService() },
      'folder:yandex:missing',
      { recursive: false },
    )
    expect(result).toBe(false)
  })

  it('не пересканирует уже scanned папку без removeMissing', async () => {
    const folder = makeFolder({ scanStatus: 'scanned', ready: true })
    const context = makeContext({ [folder.id]: folder })
    const service = makeService()

    const result = await scanFolderRecursive({ context, sourceId: 'yandex', service }, folder.id, {
      recursive: false,
    })

    expect(result).toBe(true)
    expect(service.listResources).not.toHaveBeenCalled()
  })

  it('сканирует папку и помечает ready для листа', async () => {
    const folder = makeFolder({ scanStatus: undefined })
    const context = makeContext({ [folder.id]: folder })
    const service = makeService()

    const result = await scanFolderRecursive({ context, sourceId: 'yandex', service }, folder.id, {
      recursive: false,
    })

    expect(result).toBe(true)
    expect(service.listResources).toHaveBeenCalledWith('disk:/Music')
    expect(folder.scanStatus).toBe('scanned')
    expect(folder.ready).toBe(true)
  })
})
