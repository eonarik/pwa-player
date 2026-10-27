// src/services/metadata/runAutoFetch.spec.ts
// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { runAutoFetch } from './runAutoFetch'
import { trackMetadataService } from './TrackMetadataService'
import { metadataService } from './MetadataService'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { useLibraryStore } from '@/stores/library'
import type { LibraryTrack } from '@/types/library'

vi.mock('@/plugins/registry', () => ({
  isStreamingPlugin: vi.fn((pluginId: string) => pluginId === 'zvuk'),
}))

vi.mock('./TrackMetadataService', () => ({
  trackMetadataService: {
    fetch: vi.fn(),
  },
}))

vi.mock('./MetadataService', () => ({
  metadataService: {
    applyRemote: vi.fn(),
  },
}))

function makeTrack(overrides: Partial<LibraryTrack> = {}): LibraryTrack {
  return {
    id: 'track:local:1',
    pluginId: 'local',
    folderId: 'folder:local',
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    filename: 'song.mp3',
    source: '',
    ...overrides,
  } as LibraryTrack
}

describe('runAutoFetch', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    const ui = useUiSettingsStore()
    ui.autoFetchMetadata = true
    ui.metadataThreshold = 0.75
  })

  it('не запускается, если autoFetchMetadata = false', async () => {
    const ui = useUiSettingsStore()
    ui.autoFetchMetadata = false

    await runAutoFetch(makeTrack())

    expect(trackMetadataService.fetch).not.toHaveBeenCalled()
  })

  it('не запускается для стриминговых плагинов (zvuk)', async () => {
    await runAutoFetch(makeTrack({ pluginId: 'zvuk' }))

    expect(trackMetadataService.fetch).not.toHaveBeenCalled()
  })

  it('не запускается, если hasId3Tags = true', async () => {
    await runAutoFetch(makeTrack({ hasId3Tags: true }))

    expect(trackMetadataService.fetch).not.toHaveBeenCalled()
  })

  it('не запускается, если metaSource = manual', async () => {
    await runAutoFetch(makeTrack({ metaSource: 'manual' }))

    expect(trackMetadataService.fetch).not.toHaveBeenCalled()
  })

  it('не запускается, если metaSource = auto', async () => {
    await runAutoFetch(makeTrack({ metaSource: 'auto' }))

    expect(trackMetadataService.fetch).not.toHaveBeenCalled()
  })

  it('не запускается, если metaSource = file', async () => {
    await runAutoFetch(makeTrack({ metaSource: 'file' }))

    expect(trackMetadataService.fetch).not.toHaveBeenCalled()
  })

  it('не запускается, если metaSource = unknown', async () => {
    await runAutoFetch(makeTrack({ metaSource: 'unknown' }))

    expect(trackMetadataService.fetch).not.toHaveBeenCalled()
  })

  it('запускается для обычного трека', async () => {
    vi.mocked(trackMetadataService.fetch).mockResolvedValueOnce({
      status: 'found',
      data: {
        artist: 'Artist',
        title: 'Song',
        album: 'Album',
        coverUrl: null,
        source: 'itunes',
        similarity: 0.95,
        confident: true,
      },
    })

    await runAutoFetch(makeTrack())

    expect(trackMetadataService.fetch).toHaveBeenCalledWith('Artist', 'Song', 0.75)
    expect(metadataService.applyRemote).toHaveBeenCalledWith(
      'track:local:1',
      expect.objectContaining({ similarity: 0.95 }),
    )
  })

  it('not-found → ставит metaSource = unknown', async () => {
    vi.mocked(trackMetadataService.fetch).mockResolvedValueOnce({
      status: 'not-found',
    })

    const library = useLibraryStore()
    library.tracks['track:local:1'] = makeTrack()

    await runAutoFetch(makeTrack())

    expect(library.tracks['track:local:1']!.metaSource).toBe('unknown')
  })

  it('error — не падает, ловит в catch', async () => {
    vi.mocked(trackMetadataService.fetch).mockRejectedValueOnce(new Error('network'))

    await expect(runAutoFetch(makeTrack())).resolves.toBeUndefined()
    expect(metadataService.applyRemote).not.toHaveBeenCalled()
  })
})
