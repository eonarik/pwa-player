// src/stores/playlists.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { usePlaylistsStore } from './playlists'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'

const { mockPersistence } = vi.hoisted(() => ({
  mockPersistence: {
    save: vi.fn<(playlists: Playlist[]) => Promise<void>>(() => Promise.resolve()),
    load: vi.fn<() => Promise<Playlist[] | null>>(() => Promise.resolve(null)),
    clear: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  },
}))

vi.mock('@/services/persistence/PlaylistPersistenceService', () => ({
  playlistPersistenceService: mockPersistence,
}))

// --- Вспомогательные фабрики ------------------------------------------

function makeTrack(id: string, overrides: Partial<Track> = {}): Track {
  return {
    id,
    pluginId: 'local',
    source: `https://example.com/${id}.mp3`,
    filename: `${id}.mp3`,
    title: `Track ${id}`,
    artist: 'Artist',
    album: 'Album',
    ...overrides,
  }
}

async function flushWatch() {
  await nextTick()
  await nextTick()
}

describe('usePlaylistsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockPersistence.load.mockResolvedValue(null)
    mockPersistence.save.mockResolvedValue(undefined)
    mockPersistence.clear.mockResolvedValue(undefined)
  })

  describe('пустое состояние', () => {
    it('playlists = {}', () => {
      const store = usePlaylistsStore()
      expect(store.playlists).toEqual({})
    })

    it('sortedPlaylists = []', () => {
      const store = usePlaylistsStore()
      expect(store.sortedPlaylists).toEqual([])
    })

    it('favorites = null', () => {
      const store = usePlaylistsStore()
      expect(store.favorites).toBe(null)
    })

    it('favoriteTrackIds = пустой Set', () => {
      const store = usePlaylistsStore()
      expect(store.favoriteTrackIds.size).toBe(0)
    })
  })

  describe('createPlaylist', () => {
    it('создаёт плейлист и возвращает id', () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('Мой плейлист')

      expect(id).toMatch(/^playlist:/)
      expect(store.playlists[id]).toBeDefined()
      expect(store.playlists[id]!.name).toBe('Мой плейлист')
      expect(store.playlists[id]!.tracks).toEqual([])
    })

    it('createdAt === updatedAt при создании', () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')
      const p = store.playlists[id]!
      expect(p.createdAt).toBe(p.updatedAt)
    })

    it('тримит имя и использует fallback для пустого', () => {
      const store = usePlaylistsStore()
      const id1 = store.createPlaylist('   Пробелы   ')
      const id2 = store.createPlaylist('   ')

      expect(store.playlists[id1]!.name).toBe('Пробелы')
      expect(store.playlists[id2]!.name).toBe('Новый плейлист')
    })

    it('разные вызовы дают разные id', () => {
      const store = usePlaylistsStore()
      const id1 = store.createPlaylist('A')
      const id2 = store.createPlaylist('B')
      expect(id1).not.toBe(id2)
    })
  })

  describe('renamePlaylist', () => {
    it('переименовывает пользовательский плейлист', () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('Старое')
      store.renamePlaylist(id, 'Новое')
      expect(store.playlists[id]!.name).toBe('Новое')
    })

    it('обновляет updatedAt', async () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')
      const before = store.playlists[id]!.updatedAt
      await new Promise((r) => setTimeout(r, 5))
      store.renamePlaylist(id, 'Y')
      expect(store.playlists[id]!.updatedAt).toBeGreaterThan(before)
    })

    it('не переименовывает «Избранное»', async () => {
      const store = usePlaylistsStore()
      await store.restore()
      store.renamePlaylist(FAVORITES_PLAYLIST_ID, 'Новое имя')
      expect(store.playlists[FAVORITES_PLAYLIST_ID]!.name).toBe('Избранное')
    })

    it('игнорирует несуществующий id', () => {
      const store = usePlaylistsStore()
      expect(() => store.renamePlaylist('playlist:missing', 'X')).not.toThrow()
    })

    it('не переименовывает в пустое имя', () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('Старое')
      store.renamePlaylist(id, '   ')
      expect(store.playlists[id]!.name).toBe('Старое')
    })
  })

  describe('deletePlaylist', () => {
    it('удаляет пользовательский плейлист', () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')
      store.deletePlaylist(id)
      expect(store.playlists[id]).toBeUndefined()
    })

    it('не удаляет «Избранное»', async () => {
      const store = usePlaylistsStore()
      await store.restore()
      store.deletePlaylist(FAVORITES_PLAYLIST_ID)
      expect(store.playlists[FAVORITES_PLAYLIST_ID]).toBeDefined()
    })

    it('игнорирует несуществующий id', () => {
      const store = usePlaylistsStore()
      expect(() => store.deletePlaylist('playlist:missing')).not.toThrow()
    })
  })

  describe('addTrackToPlaylist', () => {
    it('добавляет трек и возвращает true', () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')
      const track = makeTrack('t1')

      const result = store.addTrackToPlaylist(id, track)

      expect(result).toBe(true)
      expect(store.playlists[id]!.tracks.length).toBe(1)
      expect(store.playlists[id]!.tracks[0]!.trackId).toBe('t1')
    })

    it('идемпотентен: повторное добавление возвращает false', () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')
      const track = makeTrack('t1')

      store.addTrackToPlaylist(id, track)
      const result = store.addTrackToPlaylist(id, track)

      expect(result).toBe(false)
      expect(store.playlists[id]!.tracks.length).toBe(1)
    })

    it('возвращает false для несуществующего плейлиста', () => {
      const store = usePlaylistsStore()
      const result = store.addTrackToPlaylist('playlist:missing', makeTrack('t1'))
      expect(result).toBe(false)
    })

    it('обновляет updatedAt', async () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')
      const before = store.playlists[id]!.updatedAt
      await new Promise((r) => setTimeout(r, 5))
      store.addTrackToPlaylist(id, makeTrack('t1'))
      expect(store.playlists[id]!.updatedAt).toBeGreaterThan(before)
    })

    it('сохраняет snapshot с remotePath, если он есть', () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')
      const track = makeTrack('t1') as Track & { remotePath?: string }
      track.remotePath = 'disk:/Music/a.mp3'

      store.addTrackToPlaylist(id, track)

      expect(store.playlists[id]!.tracks[0]!.remotePath).toBe('disk:/Music/a.mp3')
    })

    it('сохраняет pluginId из трека', () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')
      const track = makeTrack('t1', { pluginId: 'yandex' })

      store.addTrackToPlaylist(id, track)

      expect(store.playlists[id]!.tracks[0]!.pluginId).toBe('yandex')
    })

    it('snapshot без remotePath, если трек локальный', () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')

      store.addTrackToPlaylist(id, makeTrack('t1'))

      expect(store.playlists[id]!.tracks[0]!.remotePath).toBeUndefined()
    })

    it('проставляет addedAt', () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')
      const before = Date.now()
      store.addTrackToPlaylist(id, makeTrack('t1'))
      const after = Date.now()
      const addedAt = store.playlists[id]!.tracks[0]!.addedAt
      expect(addedAt).toBeGreaterThanOrEqual(before)
      expect(addedAt).toBeLessThanOrEqual(after)
    })
  })

  describe('removeTrackFromPlaylist', () => {
    it('удаляет трек и возвращает true', () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')
      store.addTrackToPlaylist(id, makeTrack('t1'))
      store.addTrackToPlaylist(id, makeTrack('t2'))

      const result = store.removeTrackFromPlaylist(id, 't1')

      expect(result).toBe(true)
      expect(store.playlists[id]!.tracks.map((t) => t.trackId)).toEqual(['t2'])
    })

    it('возвращает false, если трека нет', () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')
      expect(store.removeTrackFromPlaylist(id, 't1')).toBe(false)
    })

    it('возвращает false для несуществующего плейлиста', () => {
      const store = usePlaylistsStore()
      expect(store.removeTrackFromPlaylist('playlist:missing', 't1')).toBe(false)
    })

    it('не обновляет updatedAt, если ничего не удалено', async () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')
      const before = store.playlists[id]!.updatedAt
      await new Promise((r) => setTimeout(r, 5))
      store.removeTrackFromPlaylist(id, 't:missing')
      expect(store.playlists[id]!.updatedAt).toBe(before)
    })
  })

  describe('toggleFavorite', () => {
    it('создаёт «Избранное» при первом добавлении', () => {
      const store = usePlaylistsStore()
      expect(store.playlists[FAVORITES_PLAYLIST_ID]).toBeUndefined()

      store.toggleFavorite(makeTrack('t1'))

      expect(store.playlists[FAVORITES_PLAYLIST_ID]).toBeDefined()
      expect(store.playlists[FAVORITES_PLAYLIST_ID]!.tracks.length).toBe(1)
    })

    it('добавляет → возвращает true, убирает → возвращает false', () => {
      const store = usePlaylistsStore()
      const track = makeTrack('t1')

      expect(store.toggleFavorite(track)).toBe(true)
      expect(store.toggleFavorite(track)).toBe(false)
      expect(store.playlists[FAVORITES_PLAYLIST_ID]!.tracks.length).toBe(0)
    })

    it('isFavorite синхронно отражает состояние', () => {
      const store = usePlaylistsStore()
      const track = makeTrack('t1')
      expect(store.isFavorite('t1')).toBe(false)
      store.toggleFavorite(track)
      expect(store.isFavorite('t1')).toBe(true)
      store.toggleFavorite(track)
      expect(store.isFavorite('t1')).toBe(false)
    })

    it('favoriteTrackIds содержит id после добавления', () => {
      const store = usePlaylistsStore()
      store.toggleFavorite(makeTrack('t1'))
      expect(store.favoriteTrackIds.has('t1')).toBe(true)
    })
  })

  describe('getPlaylist', () => {
    it('возвращает плейлист по id', () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')
      expect(store.getPlaylist(id)).not.toBe(null)
      expect(store.getPlaylist(id)!.name).toBe('X')
    })

    it('возвращает null для несуществующего', () => {
      const store = usePlaylistsStore()
      expect(store.getPlaylist('playlist:missing')).toBe(null)
    })
  })

  describe('sortedPlaylists', () => {
    it('сортирует по updatedAt desc (свежие первыми)', async () => {
      const store = usePlaylistsStore()
      const id1 = store.createPlaylist('Старый')
      await new Promise((r) => setTimeout(r, 5))
      const id2 = store.createPlaylist('Новый')

      const sorted = store.sortedPlaylists
      expect(sorted[0]!.id).toBe(id2)
      expect(sorted[1]!.id).toBe(id1)
    })

    it('обновление updatedAt переставляет плейлист наверх', async () => {
      const store = usePlaylistsStore()
      const id1 = store.createPlaylist('A')
      await new Promise((r) => setTimeout(r, 5))
      store.createPlaylist('B')

      expect(store.sortedPlaylists[store.sortedPlaylists.length - 1]!.id).toBe(id1)

      await new Promise((r) => setTimeout(r, 5))
      store.renamePlaylist(id1, 'A2')

      expect(store.sortedPlaylists[0]!.id).toBe(id1)
    })
  })

  describe('restore', () => {
    it('создаёт «Избранное», если IDB пуст', async () => {
      const store = usePlaylistsStore()
      mockPersistence.load.mockResolvedValue(null)

      const result = await store.restore()

      expect(result).toBe(true)
      expect(store.playlists[FAVORITES_PLAYLIST_ID]).toBeDefined()
    })

    it('восстанавливает плейлисты из IDB', async () => {
      const store = usePlaylistsStore()
      mockPersistence.load.mockResolvedValue([
        {
          id: 'playlist:a',
          name: 'A',
          tracks: [],
          createdAt: 1,
          updatedAt: 2,
        },
      ])

      await store.restore()

      expect(store.playlists['playlist:a']).toBeDefined()
      expect(store.playlists['playlist:a']!.name).toBe('A')
      expect(store.playlists[FAVORITES_PLAYLIST_ID]).toBeDefined()
    })

    it('не перезаписывает «Избранное», если оно было в IDB', async () => {
      const store = usePlaylistsStore()
      mockPersistence.load.mockResolvedValue([
        {
          id: FAVORITES_PLAYLIST_ID,
          name: 'Моё избранное',
          tracks: [],
          createdAt: 1,
          updatedAt: 2,
        },
      ])

      await store.restore()

      expect(store.playlists[FAVORITES_PLAYLIST_ID]!.name).toBe('Моё избранное')
    })

    it('isRestoring сбрасывается после restore', async () => {
      const store = usePlaylistsStore()
      await store.restore()
      expect(store.isRestoring).toBe(false)
    })
  })

  describe('save', () => {
    it('сохраняет plain-объекты (не reactive proxy)', async () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')
      store.addTrackToPlaylist(id, makeTrack('t1'))

      await store.save()

      expect(mockPersistence.save).toHaveBeenCalled()
      const arg = mockPersistence.save.mock.calls[0]![0]
      expect(Array.isArray(arg)).toBe(true)
      expect(arg[0]!.id).toBe(id)
    })

    it('автосохранение вызывается при изменении playlists', async () => {
      const store = usePlaylistsStore()
      vi.clearAllMocks()

      store.createPlaylist('X')
      await flushWatch()

      expect(mockPersistence.save).toHaveBeenCalled()
    })

    it('автосохранение вызывается при добавлении трека', async () => {
      const store = usePlaylistsStore()
      const id = store.createPlaylist('X')
      await flushWatch()
      vi.clearAllMocks()

      store.addTrackToPlaylist(id, makeTrack('t1'))
      await flushWatch()

      expect(mockPersistence.save).toHaveBeenCalled()
    })
  })

  describe('clear', () => {
    it('обнуляет playlists и вызывает persistence.clear', () => {
      const store = usePlaylistsStore()
      store.createPlaylist('X')

      store.clear()

      expect(mockPersistence.clear).toHaveBeenCalled()
      expect(store.playlists[FAVORITES_PLAYLIST_ID]).toBeDefined()
      const ids = Object.keys(store.playlists)
      expect(ids.length).toBe(1)
      expect(ids[0]).toBe(FAVORITES_PLAYLIST_ID)
    })
  })
})
