// src/stores/playlists.spec.ts
// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePlaylistsStore } from './playlists'
import { useLibraryStore } from './library'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import type { Track } from '@/types/track'

vi.mock('@/services/persistence/PlaylistPersistenceService', () => ({
  playlistPersistenceService: {
    load: vi.fn(async () => null),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}))

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track:1',
    pluginId: 'local',
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    sources: [{ id: 'track:1', pluginId: 'local', url: 'file://', priority: 10 }],
    filename: 'song.mp3',
    ...overrides,
  } as Track
}

describe('usePlaylistsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('ensureFavorites создаёт Избранное', async () => {
    const store = usePlaylistsStore()
    await store.restore()
    const fav = store.favorites
    expect(fav).not.toBeNull()
    expect(fav!.id).toBe(FAVORITES_PLAYLIST_ID)
  })

  it('createPlaylist', () => {
    const store = usePlaylistsStore()
    const id = store.createPlaylist('My Playlist')
    expect(store.playlists[id]).toBeDefined()
    expect(store.playlists[id]!.name).toBe('My Playlist')
  })

  it('createPlaylist с пустым именем → дефолт', () => {
    const store = usePlaylistsStore()
    const id = store.createPlaylist('   ')
    expect(store.playlists[id]!.name).toBe('Новый плейлист')
  })

  it('addTracksToPlaylist добавляет', async () => {
    const store = usePlaylistsStore()
    const id = store.createPlaylist('Test')
    const track = makeTrack()

    const added = await store.addTracksToPlaylist(id, [track])
    expect(added).toBe(1)
    expect(store.playlists[id]!.trackIds).toHaveLength(1)
    expect(store.playlists[id]!.trackIds[0]).toBe('track:1')
  })

  it('addTracksToPlaylist идемпотентен', async () => {
    const store = usePlaylistsStore()
    const id = store.createPlaylist('Test')
    const track = makeTrack()

    await store.addTracksToPlaylist(id, [track])
    const second = await store.addTracksToPlaylist(id, [track])

    expect(second).toBe(0)
    expect(store.playlists[id]!.trackIds).toHaveLength(1)
  })

  it('removeTrackFromPlaylist', async () => {
    const store = usePlaylistsStore()
    const id = store.createPlaylist('Test')
    await store.addTracksToPlaylist(id, [makeTrack()])

    const removed = store.removeTrackFromPlaylist(id, 'track:1')
    expect(removed).toBe(true)
    expect(store.playlists[id]!.trackIds).toHaveLength(0)
  })

  it('toggleFavorite', async () => {
    const store = usePlaylistsStore()
    const track = makeTrack()

    const added = await store.toggleFavorite(track)
    expect(added).toBe(true)
    expect(store.isFavorite(track.id)).toBe(true)

    const removed = await store.toggleFavorite(track)
    expect(removed).toBe(false)
    expect(store.isFavorite(track.id)).toBe(false)
  })

  it('renamePlaylist не работает для Избранного', async () => {
    const store = usePlaylistsStore()
    await store.restore()
    store.renamePlaylist(FAVORITES_PLAYLIST_ID, 'New Name')
    expect(store.favorites!.name).toBe('Избранное')
  })

  it('deletePlaylist не работает для Избранного', async () => {
    const store = usePlaylistsStore()
    await store.restore()
    store.deletePlaylist(FAVORITES_PLAYLIST_ID)
    expect(store.favorites).not.toBeNull()
  })

  it('добавление стримингового трека сохраняет его в library как виртуальный', async () => {
    const store = usePlaylistsStore()
    const library = useLibraryStore()
    const id = store.createPlaylist('Test')

    const track = makeTrack({
      id: 'zvuk:123',
      pluginId: 'zvuk',
      sources: [{ id: 'zvuk:123', pluginId: 'zvuk', url: 'https://stream', priority: 30 }],
    })

    await store.addTracksToPlaylist(id, [track])

    expect(store.playlists[id]!.trackIds[0]).toBe('zvuk:123')

    const libTrack = library.getTrack('zvuk:123')
    expect(libTrack).toBeDefined()
    expect(libTrack!.sources[0]!.url).toBe('https://stream')
    expect(libTrack!.isVirtual).toBe(true)
  })
})
