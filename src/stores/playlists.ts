// src/stores/playlists.ts

import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { playlistPersistenceService } from '@/services/persistence/PlaylistPersistenceService'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import { createTrackSnapshot } from '@/utils/trackSnapshot'
import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'

export const usePlaylistsStore = defineStore('playlists', () => {
  // --- Состояние ------------------------------------------------------

  const playlists = ref<Record<string, Playlist>>({})

  const isRestoring = ref(false)

  // --- Computed -------------------------------------------------------

  const sortedPlaylists = computed<Playlist[]>(() => {
    return Object.values(playlists.value).sort((a, b) => b.updatedAt - a.updatedAt)
  })

  const favorites = computed<Playlist | null>(() => {
    return playlists.value[FAVORITES_PLAYLIST_ID] ?? null
  })

  const favoriteTrackIds = computed<Set<string>>(() => {
    const fav = favorites.value
    if (!fav) return new Set()
    // ИСПОЛЬЗУЕМ id вместо trackId
    return new Set(fav.tracks.map((t) => t.id))
  })

  // --- Восстановление и сохранение ------------------------------------

  async function restore(): Promise<boolean> {
    isRestoring.value = true
    try {
      const loaded = await playlistPersistenceService.load()
      if (loaded && loaded.length > 0) {
        const record: Record<string, Playlist> = {}
        for (const p of loaded) {
          record[p.id] = p
        }
        playlists.value = record
      }
      ensureFavorites()
      return true
    } finally {
      isRestoring.value = false
    }
  }

  function save(): void {
    const plain = Object.values(playlists.value).map((p) =>
      JSON.parse(JSON.stringify(p)),
    ) as Playlist[]
    playlistPersistenceService.save(plain)
  }

  watch(
    playlists,
    () => {
      save()
    },
    { deep: true },
  )

  async function flush(): Promise<void> {
    await playlistPersistenceService.flush()
  }

  // --- Внутренние хелперы ---------------------------------------------

  function ensureFavorites(): void {
    if (!playlists.value[FAVORITES_PLAYLIST_ID]) {
      const now = Date.now()
      playlists.value[FAVORITES_PLAYLIST_ID] = {
        id: FAVORITES_PLAYLIST_ID,
        name: 'Избранное',
        tracks: [],
        createdAt: now,
        updatedAt: now,
      }
    }
  }

  // --- Действия -------------------------------------------------------

  function createPlaylist(name: string): string {
    const id = `playlist:${crypto.randomUUID()}`
    const now = Date.now()
    playlists.value[id] = {
      id,
      name: name.trim() || 'Новый плейлист',
      tracks: [],
      createdAt: now,
      updatedAt: now,
    }
    return id
  }

  function renamePlaylist(id: string, name: string): void {
    if (id === FAVORITES_PLAYLIST_ID) {
      console.warn('[playlists] cannot rename favorites')
      return
    }
    const playlist = playlists.value[id]
    if (!playlist) return
    playlist.name = name.trim() || playlist.name
    playlist.updatedAt = Date.now()
  }

  function deletePlaylist(id: string): void {
    if (id === FAVORITES_PLAYLIST_ID) {
      console.warn('[playlists] cannot delete favorites')
      return
    }
    delete playlists.value[id]
  }

  function addTrackToPlaylist(playlistId: string, track: Track): boolean {
    const playlist = playlists.value[playlistId]
    if (!playlist) return false

    // ИСПОЛЬЗУЕМ id вместо trackId
    const exists = playlist.tracks.some((t) => t.id === track.id)
    if (exists) return false

    playlist.tracks.push({
      ...createTrackSnapshot(track),
      addedAt: Date.now(),
    })
    playlist.updatedAt = Date.now()
    return true
  }

  function addTracksToPlaylist(playlistId: string, tracks: Track[]): number {
    const playlist = playlists.value[playlistId]
    if (!playlist) return 0

    // ИСПОЛЬЗУЕМ id вместо trackId
    const existing = new Set(playlist.tracks.map((t) => t.id))
    let added = 0
    const now = Date.now()

    for (const track of tracks) {
      if (existing.has(track.id)) continue
      existing.add(track.id)

      playlist.tracks.push({
        ...createTrackSnapshot(track),
        addedAt: now,
      })
      added++
    }

    if (added > 0) {
      playlist.updatedAt = now
    }

    return added
  }

  function removeTrackFromPlaylist(playlistId: string, trackId: string): boolean {
    const playlist = playlists.value[playlistId]
    if (!playlist) return false

    const initialLength = playlist.tracks.length
    // ИСПОЛЬЗУЕМ id вместо trackId
    playlist.tracks = playlist.tracks.filter((t) => t.id !== trackId)

    if (playlist.tracks.length !== initialLength) {
      playlist.updatedAt = Date.now()
      return true
    }
    return false
  }

  function isFavorite(trackId: string): boolean {
    return favoriteTrackIds.value.has(trackId)
  }

  function toggleFavorite(track: Track): boolean {
    ensureFavorites()
    if (isFavorite(track.id)) {
      removeTrackFromPlaylist(FAVORITES_PLAYLIST_ID, track.id)
      return false
    } else {
      addTrackToPlaylist(FAVORITES_PLAYLIST_ID, track)
      return true
    }
  }

  function getPlaylist(id: string): Playlist | null {
    return playlists.value[id] ?? null
  }

  function clear(): void {
    playlists.value = {}
    void playlistPersistenceService.clear()
    ensureFavorites()
  }

  return {
    playlists,
    isRestoring,

    sortedPlaylists,
    favorites,
    favoriteTrackIds,

    restore,
    save,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    addTracksToPlaylist,
    removeTrackFromPlaylist,
    isFavorite,
    toggleFavorite,
    getPlaylist,
    clear,
    flush,
  }
})
