// oxlint-disable vitest/require-mock-type-parameters
// src/composables/useTrackDisplay.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useTrackDisplay } from './useTrackDisplay'
import { useUiSettingsStore } from '@/stores/uiSettings'
import type { Track } from '@/types/track'

vi.mock('idb-keyval', () => ({
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => {}),
}))
vi.mock('@/plugins/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/plugins/registry')>()
  return {
    ...actual,
    getPlugins: () => [
      {
        id: 'local',
        name: 'Локальная папка',
        icon: '📁',
        version: '1',
        enabled: true,
        entry: vi.fn(),
      },
      {
        id: 'yandex',
        name: 'Яндекс.Диск',
        icon: '☁️',
        version: '1',
        enabled: true,
        entry: vi.fn(),
      },
    ],
    pluginIdFromSource: (source: string) => {
      const colon = source.indexOf(':')
      return colon === -1 ? source : source.slice(0, colon)
    },
  }
})

vi.mock('@/stores/library', () => ({
  useLibraryStore: () => ({
    getFolder: (id: string) => {
      if (id === 'folder:local:Music')
        return { id, path: 'Music', name: 'Music', source: 'local:Music' }
      return null
    },
  }),
}))

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track:1',
    pluginId: 'local:Music',
    title: 'Karma Police',
    artist: 'Radiohead',
    album: 'OK Computer',
    filename: 'song.mp3',
    path: 'song.mp3',
    source: 'file://',
    ...overrides,
  } as Track
}

describe('useTrackDisplay', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('showSource = false → title / artist', () => {
    const track = ref(makeTrack())
    const { title, subtitle, hasSubtitle } = useTrackDisplay(track)

    expect(title.value).toBe('Karma Police')
    expect(subtitle.value).toBe('')
    expect(hasSubtitle.value).toBe(false)
  })

  it('пустой artist → пустой subtitle', () => {
    const track = ref(makeTrack({ artist: '' }))
    const { subtitle, hasSubtitle } = useTrackDisplay(track)

    expect(subtitle.value).toBe('')
    expect(hasSubtitle.value).toBe(false)
  })

  it('showSource = true → subtitle = путь', () => {
    const ui = useUiSettingsStore()
    ui.showSource = true

    const track = ref(makeTrack({ folderId: 'folder:local:Music' } as Partial<Track>))
    const { subtitle } = useTrackDisplay(track)

    expect(subtitle.value).toBe('Локальная папка/Music')
  })

  it('showSource = true + нет folderId → <unknown_folder>', () => {
    const ui = useUiSettingsStore()
    ui.showSource = true

    const track = ref(makeTrack())
    const { subtitle } = useTrackDisplay(track)

    expect(subtitle.value).toContain('<unknown_folder>')
  })

  it('пустой трек → пустые строки', () => {
    const track = ref<Track | null>(null)
    const { title, subtitle } = useTrackDisplay(track)

    expect(title.value).toBe('')
    expect(subtitle.value).toBe('')
  })
})
