// src/services/metadata/runAutoFetch.ts

import { isStreamingPlugin } from '@/plugins/registry'
import { trackMetadataService } from './TrackMetadataService'
import { metadataService } from './MetadataService'
import { useLibraryStore } from '@/stores/library'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { UNKNOWN_ARTIST_PLACEHOLDER } from './constants'
import type { LibraryTrack } from '@/types/library'

/**
 * Ищет метаданные для трека в фоне (iTunes + Deezer).
 *
 * Не запускается:
 * - если выключен `autoFetchMetadata` в настройках;
 * - для стриминговых плагинов (Звук) — у них уже есть данные из API;
 * - если в файле есть ID3-теги;
 * - если метаданные уже `auto`, `file`, `manual` или `unknown`;
 * - если у трека уже есть исполнитель, альбом и обложка (нет смысла перезаписывать).
 */
export async function runAutoFetch(libTrack: LibraryTrack): Promise<void> {
  const uiSettings = useUiSettingsStore()
  if (!uiSettings.autoFetchMetadata) return

  // Стриминговые плагины не ищут метаданные — у них всё уже есть из API.
  if (isStreamingPlugin(libTrack.pluginId)) return

  if (libTrack.hasId3Tags) return

  const canAutoFetch =
    libTrack.metaSource !== 'auto' &&
    libTrack.metaSource !== 'manual' &&
    libTrack.metaSource !== 'unknown' &&
    libTrack.metaSource !== 'file'

  if (!canAutoFetch) return

  // Проверяем, есть ли уже все нужные данные (артист, альбом, обложка)
  const artist = libTrack.artist?.trim() ?? ''
  const album = libTrack.album?.trim() ?? ''
  const hasArtist = artist.length > 0 && artist !== UNKNOWN_ARTIST_PLACEHOLDER
  const hasAlbum = album.length > 0 && album !== UNKNOWN_ARTIST_PLACEHOLDER
  const hasCover = Boolean(libTrack.raw?.coverUrl || libTrack.coverUrl)

  // Если всё уже заполнено, нет смысла искать
  if (hasArtist && hasAlbum && hasCover) return

  try {
    const result = await trackMetadataService.fetch(
      libTrack.artist ?? '',
      libTrack.title,
      uiSettings.metadataThreshold,
    )

    if (result.status === 'found') {
      metadataService.applyRemote(libTrack.id, result.data)
    } else if (result.status === 'not-found') {
      useLibraryStore().updateTrackMetadata(libTrack.id, { metaSource: 'unknown' })
    }
  } catch (err) {
    console.warn('[auto-fetch] failed', err)
  }
}
