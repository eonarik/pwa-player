// src/stores/playlists.ts

import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { playlistPersistenceService } from '@/services/persistence/PlaylistPersistenceService'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import type { Playlist, PlaylistTrackSnapshot } from '@/types/playlist'
import type { Track } from '@/types/track'

export const usePlaylistsStore = defineStore('playlists', () => {
  // --- Состояние ------------------------------------------------------

  /**
   * Record, а не Map — чтобы Vue reactivity работала без сюрпризов
   * и чтобы сериализовать в IDB было проще.
   */
  const playlists = ref<Record<string, Playlist>>({})

  const isRestoring = ref(false)

  // --- Computed -------------------------------------------------------

  /** Список плейлистов, отсортированный по дате обновления (свежие сверху) */
  const sortedPlaylists = computed<Playlist[]>(() => {
    return Object.values(playlists.value).sort((a, b) => b.updatedAt - a.updatedAt)
  })

  /** Избранное как отдельный computed — часто нужно */
  const favorites = computed<Playlist | null>(() => {
    return playlists.value[FAVORITES_PLAYLIST_ID] ?? null
  })

  /** Множество trackId, которые в избранном. Для быстрой проверки в UI */
  const favoriteTrackIds = computed<Set<string>>(() => {
    const fav = favorites.value
    if (!fav) return new Set()
    return new Set(fav.tracks.map((t) => t.trackId))
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

  async function save(): Promise<void> {
    // JSON.stringify разворачивает Vue reactive proxy в plain-объекты.
    // Object.values превращает Record<string, Playlist> в Playlist[].
    const plain = Object.values(playlists.value).map((p) =>
      JSON.parse(JSON.stringify(p)),
    ) as Playlist[]
    await playlistPersistenceService.save(plain)
  }

  /** Автосохранение при любом изменении playlists */
  watch(
    playlists,
    () => {
      void save()
    },
    { deep: true },
  )

  // --- Внутренние хелперы ---------------------------------------------

  /** Гарантирует существование «Избранного» */
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

  /** Снимок трека для плейлиста */
  function toSnapshot(track: Track): PlaylistTrackSnapshot {
    // LibraryTrack имеет remotePath, Track — нет. Проверяем «мягко».
    const remotePath = (track as { remotePath?: string }).remotePath
    return {
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      remotePath,
      addedAt: Date.now(),
    }
  }

  // --- Действия -------------------------------------------------------

  /** Создать новый плейлист. Возвращает его id */
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

  /** Переименовать плейлист. Избранное переименовать нельзя */
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

  /** Удалить плейлист. Избранное удалить нельзя */
  function deletePlaylist(id: string): void {
    if (id === FAVORITES_PLAYLIST_ID) {
      console.warn('[playlists] cannot delete favorites')
      return
    }
    delete playlists.value[id]
  }

  /** Добавить трек в плейлист. Идемпотентно — дубликаты не создаются */
  function addTrackToPlaylist(playlistId: string, track: Track): boolean {
    const playlist = playlists.value[playlistId]
    if (!playlist) return false

    const exists = playlist.tracks.some((t) => t.trackId === track.id)
    if (exists) return false

    playlist.tracks.push(toSnapshot(track))
    playlist.updatedAt = Date.now()
    return true
  }

  /** Удалить трек из плейлиста */
  function removeTrackFromPlaylist(playlistId: string, trackId: string): boolean {
    const playlist = playlists.value[playlistId]
    if (!playlist) return false

    const initialLength = playlist.tracks.length
    playlist.tracks = playlist.tracks.filter((t) => t.trackId !== trackId)

    if (playlist.tracks.length !== initialLength) {
      playlist.updatedAt = Date.now()
      return true
    }
    return false
  }

  /** Проверить, есть ли трек в избранном */
  function isFavorite(trackId: string): boolean {
    return favoriteTrackIds.value.has(trackId)
  }

  /** Toggle избранного для трека */
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

  /** Получить плейлист по id */
  function getPlaylist(id: string): Playlist | null {
    return playlists.value[id] ?? null
  }

  /** Очистить всё (например, при сбросе) */
  function clear(): void {
    playlists.value = {}
    void playlistPersistenceService.clear()
    ensureFavorites()
  }

  return {
    // state
    playlists,
    isRestoring,

    // computed
    sortedPlaylists,
    favorites,
    favoriteTrackIds,

    // actions
    restore,
    save,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    isFavorite,
    toggleFavorite,
    getPlaylist,
    clear,
  }
})
