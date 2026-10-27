// src/stores/player/playerRestore.ts

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

  for (const track of tracks) {
    const libTrack = library.getTrack(track.id)

    if (!libTrack) {
      continue
    }

    if (!track.handle && libTrack.handle) {
      track.handle = libTrack.handle
    }

    // Если у трека не было источников, берем из библиотеки
    if ((!track.sources || track.sources.length === 0) && libTrack.sources) {
      track.sources = libTrack.sources
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

  const firstSource = track.sources?.[0]
  if (!track.handle && !firstSource) return

  let source: string | File
  try {
    // Используем первый попавшийся source или handle
    source = await resolveTrackSource(
      track,
      firstSource || { id: track.id, pluginId: track.pluginId, url: '', priority: 0 },
    )
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
