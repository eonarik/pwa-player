// src/services/persistence/types.ts

import type { Track } from '@/types/track';

export type PersistedTrack = Track;

export interface PersistedState {
  tracks: PersistedTrack[];
  originalTracks?: PersistedTrack[];
  currentIndex: number;
  volume: number;
  muted: boolean;
  repeatMode: 'off' | 'one' | 'all';
  shuffle: boolean;
  savedAt: number;
}

export interface PersistedPlayback {
  currentTime: number;
  trackId: string | null;
  savedAt: number;
}
