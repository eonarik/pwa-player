// src/stores/player/playerRestore.ts

import { audioService } from '@/services/audio/AudioService';
import { resolveTrackSource } from '@/services/audio/resolveTrackSource';
import { persistenceService } from '@/services/persistence/PersistenceService';
import { restoreTracks } from '@/services/persistence/restore';
import { useLibraryStore } from '@/stores/library';
import type { Track } from '@/types/track';

export interface RestoredPlayerState {
  tracks: Track[];
  currentIndex: number;
  volume: number;
  muted: boolean;
  repeatMode: 'off' | 'one' | 'all';
  shuffle: boolean;
}

export async function restorePlayerState(): Promise<RestoredPlayerState | null> {
  const state = await persistenceService.loadState();
  if (!state || state.tracks.length === 0) return null;

  const tracks = await restoreTracks(state.tracks);
  if (tracks.length === 0) return null;

  const library = useLibraryStore();

  for (const track of tracks) {
    const libTrack = library.getTrack(track.id);
    if (!libTrack) continue;
    // Если в библиотеке больше источников — обогащаем ими
    if (track.sources.length === 0 && libTrack.sources.length > 0) {
      track.sources = libTrack.sources;
    }
  }

  return {
    tracks,
    currentIndex: state.currentIndex,
    volume: state.volume,
    muted: state.muted,
    repeatMode: state.repeatMode,
    shuffle: state.shuffle,
  };
}

export async function applyRestoredPlayback(
  tracks: Track[],
  currentIndex: number,
  setCurrentTime: (t: number) => void,
): Promise<void> {
  const playback = await persistenceService.loadPlayback();
  const track = tracks[currentIndex];
  const savedTime = playback && playback.trackId === track?.id ? playback.currentTime : 0;

  if (!track) return;

  const sortedSources = [...track.sources].sort((a, b) => a.priority - b.priority);
  if (sortedSources.length === 0) return;

  let source: string | File;
  try {
    source = await resolveTrackSource(track, sortedSources[0]!);
  } catch {
    return;
  }

  audioService.load(source);

  if (savedTime > 0) {
    const unsub = audioService.on('loadedmetadata', () => {
      audioService.seek(savedTime);
      setCurrentTime(audioService.currentTime);
      unsub();
    });
  }
}
