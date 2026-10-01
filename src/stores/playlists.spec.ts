// oxlint-disable vitest/require-mock-type-parameters
// src/stores/playlists.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePlaylistsStore } from './playlists'
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
    source: 'file://',
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
    // ensureFavorites вызывается внутри restore
    // Проверяем после создания плейлиста
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

  it('addTrackToPlaylist добавляет', () => {
    const store = usePlaylistsStore()
    const id = store.createPlaylist('Test')
    const added = store.addTrackToPlaylist(id, makeTrack())
    expect(added).toBe(true)
    expect(store.playlists[id]!.tracks).toHaveLength(1)
  })

  it('addTrackToPlaylist идемпотентен', () => {
    const store = usePlaylistsStore()
    const id = store.createPlaylist('Test')
    store.addTrackToPlaylist(id, makeTrack())
    const second = store.addTrackToPlaylist(id, makeTrack())
    expect(second).toBe(false)
    expect(store.playlists[id]!.tracks).toHaveLength(1)
  })

  it('removeTrackFromPlaylist', () => {
    const store = usePlaylistsStore()
    const id = store.createPlaylist('Test')
    store.addTrackToPlaylist(id, makeTrack())
    const removed = store.removeTrackFromPlaylist(id, 'track:1')
    expect(removed).toBe(true)
    expect(store.playlists[id]!.tracks).toHaveLength(0)
  })

  it('toggleFavorite', () => {
    const store = usePlaylistsStore()
    const track = makeTrack()

    const added = store.toggleFavorite(track)
    expect(added).toBe(true)
    expect(store.isFavorite(track.id)).toBe(true)

    const removed = store.toggleFavorite(track)
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
})
