// src/composables/usePluginActions.spec.ts
// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { withSetup } from '@/test/withSetup'
import { usePluginActions } from './usePluginActions'
import { useLibraryStore } from '@/stores/library'
import { toastService } from '@/services/ui/ToastService'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import type { PluginManifest, LibrarySource } from '@/plugins/types'
import type { Folder, LibraryTrack } from '@/types/library'

const mocks = vi.hoisted(() => {
  const loadedPlugins = new Map<string, LibrarySource>()

  return {
    loadedPlugins,
    pushMock: vi.fn(),
    loadPlugin: vi.fn(async (id: string) => {
      const p = loadedPlugins.get(id)
      if (!p) throw new Error(`plugin ${id} not loaded`)
      return p
    }),
    setPluginDisconnected: vi.fn(),
  }
})

vi.mock('@/plugins/registry', () => ({
  loadPlugin: mocks.loadPlugin,
  setPluginDisconnected: mocks.setPluginDisconnected,
}))

vi.mock('@/plugins/context', () => ({
  createPluginContext: () => ({
    writer: {},
    storage: {},
    showModal: vi.fn(),
    showToast: vi.fn(),
    proxyUrl: '',
    getDownloadDir: vi.fn(async () => null),
  }),
}))

vi.mock('@/services/download/DownloadSpaceService', () => ({
  downloadSpaceService: {
    hasSpace: { value: false },
    needsPermission: { value: false },
    requestAccess: vi.fn(),
    getPluginDirIfExists: vi.fn(async () => null),
  },
}))

vi.mock('@/services/ui/ToastService', () => ({
  toastService: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/stores/library', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/library')>()
  return {
    ...actual,
    createLibraryWriter: () => ({
      removeBySource: vi.fn(),
    }),
  }
})

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: mocks.pushMock, replace: vi.fn() }),
  }
})

function makeManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: 'p1',
    name: 'P1',
    icon: '🧪',
    version: '1.0.0',
    enabled: true,
    canDownload: true,
    entry: vi.fn(),
    ...overrides,
  } as PluginManifest
}

function makePlugin(overrides: Partial<LibrarySource> = {}): LibrarySource {
  return {
    id: 'p1',
    name: 'P1',
    icon: '🧪',
    canDownload: true,
    isAvailable: () => true,
    connect: vi.fn(async () => {}),
    load: vi.fn(async () => {}),
    restoreFromCache: vi.fn(async () => false),
    buildStreamUrl: () => '',
    disconnect: vi.fn(async () => {}),
    ...overrides,
  }
}

function makeRootFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: 'folder:p1:__root__',
    name: 'P1',
    parentId: null,
    path: '',
    childFolderIds: [],
    trackIds: [],
    totalTrackCount: 0,
    source: 'p1',
    ...overrides,
  }
}

function makeTrack(overrides: Partial<LibraryTrack> = {}): LibraryTrack {
  return {
    id: 'track:p1:1',
    pluginId: 'p1',
    folderId: 'folder:p1:__root__',
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    filename: '1.mp3',
    source: '',
    ...overrides,
  } as LibraryTrack
}

function setupActions(onReload = vi.fn(async () => {})) {
  const { result, unmount } = withSetup(() => usePluginActions({ onReload }))
  return { actions: result, onReload, unmount }
}

describe('usePluginActions — openPlugin (onOpen)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.loadedPlugins.clear()
    vi.clearAllMocks()
    vi.mocked(downloadSpaceService.getPluginDirIfExists).mockResolvedValue(null)
    downloadSpaceService.hasSpace.value = false
    downloadSpaceService.needsPermission.value = false
  })

  it('кэш есть (root + tracks) → открывает папку, restoreFromCache/connect/load не вызываются', async () => {
    const connect = vi.fn(async () => {})
    const load = vi.fn(async () => {})
    const restoreFromCache = vi.fn(async () => true)
    mocks.loadedPlugins.set('p1', makePlugin({ id: 'p1', connect, load, restoreFromCache }))

    const library = useLibraryStore()
    const root = makeRootFolder({ trackIds: ['track:p1:1'] })
    library.folders[root.id] = root
    library.tracks['track:p1:1'] = makeTrack()

    const { actions, unmount } = setupActions()
    await actions.openPlugin({ manifest: makeManifest() }, { localOnly: false })

    expect(restoreFromCache).not.toHaveBeenCalled()
    expect(connect).not.toHaveBeenCalled()
    expect(load).not.toHaveBeenCalled()
    expect(mocks.pushMock).toHaveBeenCalledWith({
      name: 'folder',
      params: { pluginId: 'p1', path: [] },
    })

    unmount()
  })

  it('кэша нет, disconnected → connect → load → открыть', async () => {
    const connect = vi.fn(async () => {})
    const load = vi.fn(async () => {
      const library = useLibraryStore()
      const root = makeRootFolder({ trackIds: ['track:p1:1'] })
      library.folders[root.id] = root
      library.tracks['track:p1:1'] = makeTrack()
    })
    mocks.loadedPlugins.set(
      'p1',
      makePlugin({
        id: 'p1',
        connect,
        load,
        restoreFromCache: vi.fn(async () => false),
        isDisconnected: () => true,
      }),
    )

    const { actions, unmount } = setupActions()
    await actions.openPlugin({ manifest: makeManifest() }, { localOnly: false })

    expect(connect).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledWith(expect.anything(), { forceRefresh: true })
    expect(mocks.pushMock).toHaveBeenCalled()

    unmount()
  })

  it('кэша нет, connected → load → открыть', async () => {
    const connect = vi.fn(async () => {})
    const load = vi.fn(async () => {
      const library = useLibraryStore()
      const root = makeRootFolder({ trackIds: ['track:p1:1'] })
      library.folders[root.id] = root
      library.tracks['track:p1:1'] = makeTrack()
    })
    mocks.loadedPlugins.set(
      'p1',
      makePlugin({
        id: 'p1',
        connect,
        load,
        restoreFromCache: vi.fn(async () => false),
      }),
    )

    const { actions, unmount } = setupActions()
    await actions.openPlugin({ manifest: makeManifest() }, { localOnly: false })

    expect(connect).not.toHaveBeenCalled()
    expect(load).toHaveBeenCalledOnce()
    expect(mocks.pushMock).toHaveBeenCalled()

    unmount()
  })

  it('connect → cancelled → ничего', async () => {
    let disconnected = false
    const connect = vi.fn(async () => {
      throw new Error('cancelled')
    })
    mocks.loadedPlugins.set(
      'p1',
      makePlugin({
        id: 'p1',
        connect,
        restoreFromCache: vi.fn(async () => false),
        isDisconnected: () => disconnected,
      }),
    )

    const { actions, unmount } = setupActions()
    disconnected = true

    await actions.openPlugin({ manifest: makeManifest() }, { localOnly: false })

    expect(connect).toHaveBeenCalledOnce()
    expect(mocks.pushMock).not.toHaveBeenCalled()

    unmount()
  })

  it('connect → redirect → ничего', async () => {
    let disconnected = false
    const connect = vi.fn(async () => {
      throw new Error('redirect')
    })
    mocks.loadedPlugins.set(
      'p1',
      makePlugin({
        id: 'p1',
        connect,
        restoreFromCache: vi.fn(async () => false),
        isDisconnected: () => disconnected,
      }),
    )

    const { actions, unmount } = setupActions()
    disconnected = true

    await actions.openPlugin({ manifest: makeManifest() }, { localOnly: false })

    expect(connect).toHaveBeenCalledOnce()
    expect(mocks.pushMock).not.toHaveBeenCalled()

    unmount()
  })

  it('load упал → тост, папку не открывает', async () => {
    const load = vi.fn(async () => {
      throw new Error('boom')
    })
    mocks.loadedPlugins.set(
      'p1',
      makePlugin({
        id: 'p1',
        load,
        restoreFromCache: vi.fn(async () => false),
      }),
    )

    const { actions, unmount } = setupActions()
    await actions.openPlugin({ manifest: makeManifest() }, { localOnly: false })

    expect(toastService.error).toHaveBeenCalled()
    expect(mocks.pushMock).not.toHaveBeenCalled()

    unmount()
  })

  it('после load root нет → тост «не содержит данных»', async () => {
    mocks.loadedPlugins.set(
      'p1',
      makePlugin({
        id: 'p1',
        load: vi.fn(async () => {}),
        restoreFromCache: vi.fn(async () => false),
      }),
    )

    const { actions, unmount } = setupActions()
    await actions.openPlugin({ manifest: makeManifest() }, { localOnly: false })

    expect(toastService.error).toHaveBeenCalledWith(expect.stringContaining('не содержит данных'))

    unmount()
  })
})

describe('usePluginActions — openPlugin (onOpenLocal)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.loadedPlugins.clear()
    vi.clearAllMocks()
    vi.mocked(downloadSpaceService.getPluginDirIfExists).mockResolvedValue(null)
  })

  it('restoreFromLocalFiles → true → открывает папку, connect не вызывается', async () => {
    const connect = vi.fn(async () => {})
    const restoreFromLocalFiles = vi.fn(async () => {
      const library = useLibraryStore()
      const root = makeRootFolder({ trackIds: ['track:p1:1'] })
      library.folders[root.id] = root
      library.tracks['track:p1:1'] = makeTrack()
      return true
    })
    mocks.loadedPlugins.set(
      'p1',
      makePlugin({
        id: 'p1',
        connect,
        restoreFromLocalFiles,
        isDisconnected: () => true,
      }),
    )

    const { actions, unmount } = setupActions()
    await actions.openPlugin({ manifest: makeManifest() }, { localOnly: true })

    expect(restoreFromLocalFiles).toHaveBeenCalledOnce()
    expect(connect).not.toHaveBeenCalled()
    expect(mocks.pushMock).toHaveBeenCalled()

    unmount()
  })

  it('restoreFromLocalFiles → false → ошибка', async () => {
    mocks.loadedPlugins.set(
      'p1',
      makePlugin({
        id: 'p1',
        restoreFromLocalFiles: vi.fn(async () => false),
        isDisconnected: () => true,
      }),
    )

    const { actions, unmount } = setupActions()
    await actions.openPlugin({ manifest: makeManifest() }, { localOnly: true })

    expect(toastService.error).toHaveBeenCalledWith(expect.stringContaining('не найдены'))
    expect(mocks.pushMock).not.toHaveBeenCalled()

    unmount()
  })

  it('restoreFromLocalFiles бросил → ошибка', async () => {
    mocks.loadedPlugins.set(
      'p1',
      makePlugin({
        id: 'p1',
        restoreFromLocalFiles: vi.fn(async () => {
          throw new Error('permission')
        }),
        isDisconnected: () => true,
      }),
    )

    const { actions, unmount } = setupActions()
    await actions.openPlugin({ manifest: makeManifest() }, { localOnly: true })

    expect(toastService.error).toHaveBeenCalledWith(expect.stringContaining('permission'))
    expect(mocks.pushMock).not.toHaveBeenCalled()

    unmount()
  })
})

describe('usePluginActions — isLoading', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.loadedPlugins.clear()
    vi.clearAllMocks()
    vi.mocked(downloadSpaceService.getPluginDirIfExists).mockResolvedValue(null)
  })

  it('во время openPlugin isLoading = pluginId, после — null', async () => {
    let resolveLoad: () => void = () => {}
    const loadPromise = new Promise<void>((resolve) => {
      resolveLoad = resolve
    })

    mocks.loadedPlugins.set(
      'p1',
      makePlugin({
        id: 'p1',
        load: vi.fn(async () => {
          await loadPromise
        }),
        restoreFromCache: vi.fn(async () => false),
      }),
    )

    const { actions, unmount } = setupActions()

    const promise = actions.openPlugin({ manifest: makeManifest() }, { localOnly: false })

    // Дать микротаскам прокрутиться, чтобы isLoading установился.
    await Promise.resolve()
    expect(actions.isLoading.value).toBe('p1')

    resolveLoad()
    await promise
    expect(actions.isLoading.value).toBeNull()

    unmount()
  })
})
