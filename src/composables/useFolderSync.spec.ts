// src/composables/useFolderSync.spec.ts
// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useFolderSync } from './useFolderSync'
import type { Folder } from '@/types/library'

vi.mock('@/plugins/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/plugins/registry')>()
  return {
    ...actual,
    loadPlugin: vi.fn(async (id: string) => ({
      id,
      scanFolder: vi.fn(),
      scanDownloadDir: vi.fn(),
      canDownload: true,
    })),
    pluginIdFromSource: (source: string) => source.split(':')[0] ?? source,
  }
})

vi.mock('@/plugins/context', () => ({
  createPluginContext: () => ({}),
}))

vi.mock('@/services/download/SyncService', () => ({
  syncService: { syncAll: vi.fn(async () => []) },
}))

vi.mock('@/services/ui/ToastService', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

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
    scanStatus: 'scanned',
    ready: true,
    ...overrides,
  } as Folder
}

describe('useFolderSync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('canRefresh = true для плагина с scanFolder', async () => {
    const folder = ref<Folder | null>(makeFolder())
    const sync = useFolderSync(folder)
    await nextTick()
    await nextTick() // дождаться async watch
    expect(sync.canRefresh.value).toBe(true)
    expect(sync.canRefreshFromDevice.value).toBe(true)
  })

  it('canRefresh = false, если currentFolder = null', async () => {
    const folder = ref<Folder | null>(null)
    const sync = useFolderSync(folder)
    await nextTick()
    expect(sync.canRefresh.value).toBe(false)
    expect(sync.canRefreshFromDevice.value).toBe(false)
  })
})
