// src/composables/usePlaylistRematch.ts

import type { Ref } from 'vue'
import { usePlaylistsStore } from '@/stores/playlists'
import { useLibraryStore } from '@/stores/library'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { findBestMatch } from '@/services/playlists/PlaylistMatcher'
import { toastService } from '@/services/ui/ToastService'
import type { Playlist } from '@/types/playlist'
import { usePlayerStore } from '@/stores/player'

export function usePlaylistRematch(playlist: Ref<Playlist | null>): {
  rematch: () => void
} {
  const playlists = usePlaylistsStore()
  const library = useLibraryStore()
  const uiSettings = useUiSettingsStore()

  function rematch(): void {
    if (!playlist.value) return

    const allTracks = Object.values(library.tracks)
    if (allTracks.length === 0) return

    let changed = false
    const threshold = uiSettings.playlistMatchThreshold

    for (const snapshot of playlist.value.tracks) {
      const existing = library.getTrack(snapshot.id)

      // Если трек уже есть в библиотеке, проверяем, не нужно ли дозаполнить данные
      if (existing) {
        let updated = false

        // Если в локальном треке пустой artist, а в снимке есть — берем из снимка
        if (!existing.artist && snapshot.artist) {
          existing.artist = snapshot.artist
          updated = true
        }
        if (!existing.title && snapshot.title) {
          existing.title = snapshot.title
          updated = true
        }
        if (!existing.album && snapshot.album) {
          existing.album = snapshot.album
          updated = true
        }
        if (!existing.coverUrl && snapshot.coverUrl) {
          existing.coverUrl = snapshot.coverUrl
          updated = true
        }
        // Если у локального трека нет source (он локальный), но есть duration из снимка, можно тоже подтянуть
        if (!existing.duration && snapshot.duration) {
          existing.duration = snapshot.duration
          updated = true
        }

        if (updated) {
          // Обновляем трек в библиотеке
          library.updateTrackMetadata(existing.id, {
            artist: existing.artist,
            title: existing.title,
            album: existing.album,
            coverUrl: existing.coverUrl,
          })
          // Для duration нужен отдельный метод, если его нет в updateTrackMetadata
          if (snapshot.duration) {
            usePlayerStore().updateTrackInQueue(existing.id) // обновляем в плеере, если он там есть
          }
          changed = true
        }
        continue // Этот трек уже обработан, идем к следующему
      }

      // Если трека нет в библиотеке, ищем лучшее совпадение
      const match = findBestMatch(
        {
          title: snapshot.title,
          artist: snapshot.artist,
          album: snapshot.album,
        },
        allTracks,
        threshold,
      )

      if (match.track) {
        // Обновляем снимок, но сохраняем старые данные, если новых нет
        snapshot.id = match.track.id
        snapshot.pluginId = match.track.pluginId
        snapshot.remotePath = match.track.remotePath

        // Дозаполняем пустые поля из match.track (локального)
        if (!snapshot.title && match.track.title) snapshot.title = match.track.title
        if (!snapshot.artist && match.track.artist) snapshot.artist = match.track.artist
        if (!snapshot.album && match.track.album) snapshot.album = match.track.album
        if (!snapshot.coverUrl && match.track.coverUrl) snapshot.coverUrl = match.track.coverUrl
        if (!snapshot.duration && match.track.duration) snapshot.duration = match.track.duration

        changed = true
      }
    }

    if (changed) {
      playlists.save()
      toastService.info('Найдены новые совпадения в плейлисте')
    }
  }

  return { rematch }
}
