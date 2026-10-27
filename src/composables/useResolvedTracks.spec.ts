// src/composables/useResolvedTracks.spec.ts
// oxlint-disable vitest/require-mock-type-parameters
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useResolvedTracks } from './useResolvedTracks'
import { useLibraryStore } from '@/stores/library'
import type { TrackSnapshot } from '@/types/snapshot'

vi.mock('@/plugins/registry', () => ({
  isStreamingPlugin: (pluginId: string) => pluginId === 'zvuk',
  pluginIdFromSource: (source: string) => source.split(':')[0],
}))

describe('useResolvedTracks', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('возвращает локальный трек из библиотеки', () => {
    const library = useLibraryStore()
    library.tracks['track:local:1'] = {
      id: 'track:local:1',
      pluginId: 'local',
      folderId: 'folder:local',
      title: 'Local Song',
      artist: 'Artist',
      album: 'Album',
      filename: '1.mp3',
      source: '',
      fileLocation: 'local-only',
    }

    const snapshots = ref<TrackSnapshot[]>([
      {
        id: 'track:local:1',
        pluginId: 'local',
        title: 'Local Song (snapshot)',
        artist: 'Artist',
      },
    ])

    const resolved = useResolvedTracks(snapshots)
    expect(resolved.value).toHaveLength(1)
    // Должен вернуться трек из библиотеки, а не из снимка
    expect(resolved.value[0]!.title).toBe('Local Song')
  })

  it('возвращает виртуальный трек для стриминга', () => {
    const snapshots = ref<TrackSnapshot[]>([
      {
        id: 'track:zvuk:123',
        pluginId: 'zvuk',
        title: 'Zvuk Song',
        artist: 'Zvuk Artist',
        album: 'Zvuk Album',
        source: 'https://stream',
        coverUrl: 'https://cover',
        duration: 200,
      },
    ])

    const resolved = useResolvedTracks(snapshots)
    expect(resolved.value).toHaveLength(1)
    expect(resolved.value[0]!.title).toBe('Zvuk Song')
    expect(resolved.value[0]!.source).toBe('https://stream')
  })

  it('игнорирует снимки без source и без трека в библиотеке', () => {
    const snapshots = ref<TrackSnapshot[]>([
      {
        id: 'track:missing:1',
        pluginId: 'local',
        title: 'Missing',
        artist: '',
      },
    ])

    const resolved = useResolvedTracks(snapshots)
    expect(resolved.value).toHaveLength(0)
  })
})
