// src/stores/player/playerRestore.ts

import { getPlugins } from '@/plugins/registry'
import { audioService } from '@/services/audio/AudioService'
import { resolveTrackSource } from '@/services/audio/resolveTrackSource'
import { persistenceService } from '@/services/persistence/PersistenceService'
import { restoreTracks } from '@/services/persistence/restore'
import { useLibraryStore } from '@/stores/library'
import type { Track } from '@/types/track'

export interface RestoredPlayerState {
  tracks: Track[]
  currentIndex: number
  volume: number
  muted: boolean
  repeatMode: 'off' | 'one' | 'all'
  shuffle: boolean
}

export async function restorePlayerState(): Promise<RestoredPlayerState | null> {
  const state = await persistenceService.loadState()
  if (!state || state.tracks.length === 0) return null

  const tracks = await restoreTracks(state.tracks)
  if (tracks.length === 0) return null

  const library = useLibraryStore()

  // Плагины без библиотеки (radio, podcasts) — source не сбрасываем,
  // даже если трека нет в library.
  const statelessPluginIds = new Set(
    getPlugins()
      .filter((p) => p.isStateless)
      .map((p) => p.id),
  )

  for (const track of tracks) {
    const libTrack = library.getTrack(track.id)

    if (!libTrack) {
      const pluginId = track.pluginId.split(':')[0] ?? track.pluginId
      const isStateless = statelessPluginIds.has(pluginId)

      if (!isStateless && !track.handle) {
        // Трек из плагина с библиотекой, но его там нет (отключён / удалён).
        // Локальный handle сохраняем — если файл есть, играть можно.
        // Облачный source сбрасываем, чтобы не было запросов с протухшим токеном.
        track.source = ''
      }
      continue
    }

    if (!track.coverUrl && libTrack.coverUrl) {
      track.coverUrl = libTrack.coverUrl
    }

    if (!track.handle && libTrack.handle) {
      track.handle = libTrack.handle
    }

    if (!track.source && typeof libTrack.source === 'string' && libTrack.source) {
      track.source = libTrack.source
    }
  }

  return {
    tracks,
    currentIndex: state.currentIndex,
    volume: state.volume,
    muted: state.muted,
    repeatMode: state.repeatMode,
    shuffle: state.shuffle,
  }
}

export async function applyRestoredPlayback(
  tracks: Track[],
  currentIndex: number,
  setCurrentTime: (t: number) => void,
): Promise<void> {
  const playback = await persistenceService.loadPlayback()
  const track = tracks[currentIndex]
  const savedTime = playback && playback.trackId === track?.id ? playback.currentTime : 0

  if (!track) return

  // Не грузим, если источник недоступен (нет handle и нет source).
  if (!track.handle && !track.source) return

  let source: string | File
  try {
    source = await resolveTrackSource(track)
  } catch {
    return
  }

  audioService.load(source)

  if (savedTime > 0) {
    const unsub = audioService.on('loadedmetadata', () => {
      audioService.seek(savedTime)
      setCurrentTime(audioService.currentTime)
      unsub()
    })
  }
}
