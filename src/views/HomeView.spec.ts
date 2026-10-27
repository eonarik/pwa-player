// src/views/HomeView.spec.ts
// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import HomeView from './HomeView.vue'
import type { PluginManifest, LibrarySource } from '@/plugins/types'

const mocks = vi.hoisted(() => {
  const pluginsRef = { value: [] as PluginManifest[] }
  const loadedPlugins = new Map<string, LibrarySource>()
  const pluginDisconnected = new Map<string, boolean>()
  const writeLog: string[] = []

  return {
    pluginsRef,
    loadedPlugins,
    pluginDisconnected,
    writeLog,
    loadPlugin: vi.fn(async (id: string) => {
      const p = loadedPlugins.get(id)
      if (!p) throw new Error(`plugin ${id} not loaded`)
      return p
    }),
    getPlugins: () => pluginsRef.value,
    setPluginDisconnected: vi.fn((id: string, val: boolean) => {
      pluginDisconnected.set(id, val)
    }),
    isPluginActivated: vi.fn(() => true),
  }
})

vi.mock('@/plugins/registry', () => ({
  getPlugins: mocks.getPlugins,
  loadPlugin: mocks.loadPlugin,
  setPluginDisconnected: mocks.setPluginDisconnected,
  isPluginActivated: mocks.isPluginActivated,
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
    hasSpace: ref(false),
    needsPermission: ref(false),
    spaceName: ref(null),
    requestAccess: vi.fn(),
    getPluginDirIfExists: vi.fn(),
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
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  }
})

vi.mock('@/services/download/scanDirectory', () => ({
  scanDirectory: vi.fn(async () => new Map()),
}))

function makeManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: 'test',
    name: 'Test',
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
    id: 'test',
    name: 'Test',
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

function mountHome() {
  return mount(HomeView, {
    global: {
      stubs: {
        RouterLink: true,
        Icon: true,
      },
    },
  })
}

async function flush() {
  await new Promise((r) => setTimeout(r, 0))
}

describe('HomeView — checkSession', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.pluginsRef.value = []
    mocks.loadedPlugins.clear()
    mocks.pluginDisconnected.clear()
    vi.clearAllMocks()
  })

  it('для stateless плагина checkSessionFor не вызывается', async () => {
    const checkSession = vi.fn(async () => 'ok' as const)
    mocks.pluginsRef.value = [makeManifest({ id: 'radio', isStateless: true })]
    mocks.loadedPlugins.set('radio', makePlugin({ id: 'radio', checkSession }))

    mountHome()
    await flush()
    await flush()

    expect(checkSession).not.toHaveBeenCalled()
  })

  it('без checkSession → статус ok', async () => {
    mocks.pluginsRef.value = [makeManifest({ id: 'p1' })]
    mocks.loadedPlugins.set('p1', makePlugin({ id: 'p1' }))

    const wrapper = mountHome()
    await flush()
    await flush()

    expect(wrapper.text()).not.toContain('Сессия истекла')
    expect(wrapper.text()).not.toContain('Проверка доступности')
  })

  it('checkSession → expired → markDisconnected + setPluginDisconnected', async () => {
    const checkSession = vi.fn(async () => 'expired' as const)
    const markDisconnected = vi.fn()
    mocks.pluginsRef.value = [makeManifest({ id: 'p1' })]
    mocks.loadedPlugins.set('p1', makePlugin({ id: 'p1', checkSession, markDisconnected }))

    mountHome()
    await flush()
    await flush()

    expect(markDisconnected).toHaveBeenCalledOnce()
    expect(mocks.setPluginDisconnected).toHaveBeenCalledWith('p1', true)
  })

  it('checkSession → unavailable → статус unavailable, без markDisconnected', async () => {
    const checkSession = vi.fn(async () => 'unavailable' as const)
    const markDisconnected = vi.fn()
    mocks.pluginsRef.value = [makeManifest({ id: 'p1' })]
    mocks.loadedPlugins.set('p1', makePlugin({ id: 'p1', checkSession, markDisconnected }))

    const wrapper = mountHome()
    await flush()
    await flush()

    expect(markDisconnected).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Сервер недоступен')
  })

  it('checkSession → ok → ничего не делает', async () => {
    const checkSession = vi.fn(async () => 'ok' as const)
    const markDisconnected = vi.fn()
    mocks.pluginsRef.value = [makeManifest({ id: 'p1' })]
    mocks.loadedPlugins.set('p1', makePlugin({ id: 'p1', checkSession, markDisconnected }))

    mountHome()
    await flush()
    await flush()

    expect(markDisconnected).not.toHaveBeenCalled()
    expect(mocks.setPluginDisconnected).not.toHaveBeenCalled()
  })
})
