// src/stores/player/playerRestore.ts

import { audioService } from '@/services/audio/AudioService'
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

/**
 * Восстанавливает сохранённую очередь и позицию воспроизведения.
 *
 * Возвращает объект с восстановленными значениями или null, если
 * восстанавливать нечего. Состояние применяет вызывающий (стор),
 * чтобы эта функция не зависела от Pinia.
 */
export async function restorePlayerState(): Promise<RestoredPlayerState | null> {
  const state = await persistenceService.loadState()
  if (!state || state.tracks.length === 0) return null

  const tracks = await restoreTracks(state.tracks)
  if (tracks.length === 0) return null

  const library = useLibraryStore()
  for (const track of tracks) {
    const libTrack = library.getTrack(track.id)
    if (!libTrack) continue

    if (!track.coverUrl && libTrack.coverUrl) {
      track.coverUrl = libTrack.coverUrl
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

/**
 * Применяет восстановленное состояние к аудиосервису: громкость,
 * загрузка трека, восстановление позиции.
 *
 * Вызывается из `player.restore()` после того, как стор обновлён.
 */
export async function applyRestoredPlayback(
  tracks: Track[],
  currentIndex: number,
  setCurrentTime: (t: number) => void,
): Promise<void> {
  const playback = await persistenceService.loadPlayback()
  const track = tracks[currentIndex]
  const savedTime = playback && playback.trackId === track?.id ? playback.currentTime : 0

  if (!track || !track.source) return

  audioService.load(track.source)

  if (savedTime > 0) {
    const unsub = audioService.on('loadedmetadata', () => {
      audioService.seek(savedTime)
      setCurrentTime(audioService.currentTime)
      unsub()
    })
  }
}
