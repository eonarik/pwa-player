// src/plugins/yandexDisk/createPlugin.spec.ts
// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createYandexPlugin } from './createPlugin'
import type { IYandexService } from './types'
import type { PluginContext } from '../types'

vi.mock('./scan', () => ({
  backgroundScan: vi.fn(async () => {}),
  currentLibraryFromWriter: vi.fn(() => ({
    folders: [],
    tracks: [],
    rootFolderId: 'folder:x',
    rootFolderName: 'X',
  })),
  loadRootContent: vi.fn(async () => ({ folders: [], tracks: [] })),
  refreshSubtree: vi.fn(async () => ({ tracks: 0, files: 0 })),
}))

vi.mock('./persistence', () => ({
  yandexPersistenceService: {
    load: vi.fn(async () => null),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
    isFresh: vi.fn(() => false),
  },
}))

vi.mock('./persist', () => ({
  fromPersisted: vi.fn(() => ({
    folders: [],
    tracks: [],
    rootFolderId: '',
    rootFolderName: '',
  })),
  toPersisted: vi.fn(() => ({
    folders: [],
    tracks: [],
    rootFolderId: '',
    rootFolderName: '',
    rootPath: '',
    savedAt: 0,
  })),
  enrichWithLocalFiles: vi.fn(async () => {}),
}))

vi.mock('./scanFolder', () => ({
  scanFolderRecursive: vi.fn(async () => true),
}))

vi.mock('./download', () => ({
  downloadTrackToDir: vi.fn(async () => ({ relativePath: '', size: 0 })),
  removeDownloadedFromDir: vi.fn(async () => {}),
}))

vi.mock('./sync', () => ({
  scanDownloadDirForSource: vi.fn(async () => ({
    downloaded: new Map(),
    onlyLocal: [],
    missing: [],
  })),
  createLocalTrackFromFile: vi.fn(async () => null),
  restoreLibraryFromFiles: vi.fn(async () => false),
  mergeLocalIntoLibrary: vi.fn(async () => {}),
}))

type SessionResult = 'ok' | 'expired' | 'unavailable'

function makeService(overrides: Partial<IYandexService> = {}): IYandexService {
  return {
    listResources: vi.fn(async () => ({ path: '', total: 0, items: [] })),
    buildDownloadUrl: vi.fn(() => ''),
    readTextFile: vi.fn(async () => null),
    writeTextFile: vi.fn(async () => ({ ok: true, modified: null })),
    ...overrides,
  }
}

function makeContext(): PluginContext {
  return {
    writer: {} as never,
    storage: {} as never,
    showModal: vi.fn(),
    showToast: vi.fn(),
    proxyUrl: '',
    getDownloadDir: vi.fn(async () => null),
  }
}

describe('createYandexPlugin — checkSession / markDisconnected', () => {
  it('checkSession → ok, если service.checkSession возвращает ok', async () => {
    const service = makeService({
      checkSession: vi.fn(async (): Promise<SessionResult> => 'ok'),
    })
    const plugin = createYandexPlugin({ id: 'yandex', name: 'Y', icon: '', service })

    expect(await plugin.checkSession!()).toBe('ok')
    expect(service.checkSession).toHaveBeenCalledOnce()
  })

  it('checkSession → expired, если service.checkSession возвращает expired', async () => {
    const service = makeService({
      checkSession: vi.fn(async (): Promise<SessionResult> => 'expired'),
    })
    const plugin = createYandexPlugin({ id: 'yandex', name: 'Y', icon: '', service })

    expect(await plugin.checkSession!()).toBe('expired')
  })

  it('checkSession → ok, если service.checkSession не реализован', async () => {
    const service = makeService()
    const plugin = createYandexPlugin({ id: 'yandex', name: 'Y', icon: '', service })

    expect(await plugin.checkSession!()).toBe('ok')
  })

  it('markDisconnected вызывает service.setDisconnected(true)', () => {
    const setDisconnected = vi.fn()
    const service = makeService({ setDisconnected })
    const plugin = createYandexPlugin({ id: 'yandex', name: 'Y', icon: '', service })

    plugin.markDisconnected!()
    expect(setDisconnected).toHaveBeenCalledWith(true)
  })

  it('markDisconnected не падает, если setDisconnected не реализован', () => {
    const service = makeService()
    const plugin = createYandexPlugin({ id: 'yandex', name: 'Y', icon: '', service })

    expect(() => plugin.markDisconnected!()).not.toThrow()
  })
})

describe('createYandexPlugin — connect (isSelf)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('не показывает модалку, если checkSession → ok', async () => {
    const login = vi.fn(async () => true)
    const checkSession = vi.fn(async () => 'ok' as const)
    const service = makeService({ login, checkSession })
    const plugin = createYandexPlugin({
      id: 'yandex-self',
      name: 'Self',
      icon: '',
      service,
      isSelf: true,
    })

    const context = makeContext()
    await plugin.connect(context)

    expect(checkSession).toHaveBeenCalledOnce()
    expect(context.showModal).not.toHaveBeenCalled()
    expect(login).not.toHaveBeenCalled()
  })

  it('показывает модалку, если checkSession → expired', async () => {
    const login = vi.fn(async () => true)
    const checkSession = vi.fn(async () => 'expired' as const)
    const service = makeService({ login, checkSession })
    const plugin = createYandexPlugin({
      id: 'yandex-self',
      name: 'Self',
      icon: '',
      service,
      isSelf: true,
    })

    const context = makeContext()
    vi.mocked(context.showModal).mockResolvedValue('pass')

    await plugin.connect(context)

    expect(context.showModal).toHaveBeenCalledOnce()
    expect(login).toHaveBeenCalledWith('common', 'pass')
  })

  it('показывает модалку, если checkSession не реализован', async () => {
    const login = vi.fn(async () => true)
    const service = makeService({ login })
    const plugin = createYandexPlugin({
      id: 'yandex-self',
      name: 'Self',
      icon: '',
      service,
      isSelf: true,
    })

    const context = makeContext()
    vi.mocked(context.showModal).mockResolvedValue('pass')

    await plugin.connect(context)

    expect(context.showModal).toHaveBeenCalledOnce()
  })

  it('cancelled — бросает cancelled', async () => {
    const service = makeService({
      login: vi.fn(async () => true),
      checkSession: vi.fn(async () => 'expired' as const),
    })
    const plugin = createYandexPlugin({
      id: 'yandex-self',
      name: 'Self',
      icon: '',
      service,
      isSelf: true,
    })

    const context = makeContext()
    vi.mocked(context.showModal).mockResolvedValue(null)

    await expect(plugin.connect(context)).rejects.toThrow('cancelled')
  })

  it('неверный пароль — бросает ошибку', async () => {
    const service = makeService({
      login: vi.fn(async () => false),
      checkSession: vi.fn(async () => 'expired' as const),
    })
    const plugin = createYandexPlugin({
      id: 'yandex-self',
      name: 'Self',
      icon: '',
      service,
      isSelf: true,
    })

    const context = makeContext()
    vi.mocked(context.showModal).mockResolvedValue('wrong')

    await expect(plugin.connect(context)).rejects.toThrow('Неверный пароль или контекст')
  })
})
