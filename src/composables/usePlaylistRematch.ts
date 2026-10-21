// src/composables/usePlaylistRematch.ts

import type { Ref } from 'vue'
import { usePlaylistsStore } from '@/stores/playlists'
import { useLibraryStore } from '@/stores/library'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { findBestMatch } from '@/services/playlists/PlaylistMatcher'
import { toastService } from '@/services/ui/ToastService'
import type { Playlist } from '@/types/playlist'

/**
 * Автоматическое пересопоставление треков плейлиста с библиотекой.
 *
 * Если в плейлисте есть snapshot с trackId, которого нет в библиотеке
 * (трек был импортирован, когда источник не был подключён, или трек
 * переехал), пытаемся найти совпадение через `findBestMatch`.
 * При успехе обновляем snapshot на актуальный trackId.
 *
 * Возвращает функцию `rematch()`, которую вызывают при заходе
 * в плейлист. Если изменений не было — ничего не делает.
 */
export function usePlaylistRematch(playlist: Ref<Playlist | null>): {
  rematch: () => void
} {
  const playlists = usePlaylistsStore()
  const library = useLibraryStore()
  const uiSettings = useUiSettingsStore()

  function rematch(): void {
    if (!playlist.value) return

    const allTracks = Object.values(library.tracks)
    let changed = false
    const threshold = uiSettings.playlistMatchThreshold

    for (const snapshot of playlist.value.tracks) {
      const existing = library.getTrack(snapshot.trackId)
      if (existing) continue

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
        snapshot.trackId = match.track.id
        snapshot.pluginId = match.track.pluginId
        snapshot.remotePath = match.track.remotePath
        snapshot.title = match.track.title
        snapshot.artist = match.track.artist
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
