// src/services/persistence/types.ts

import type { Track } from '@/types/track';

/**
 * Для персистентности плеера мы сохраняем Track как есть.
 * (FileSystemFileHandle в sources[].handle — idb-keyval умеет.)
 */
export type PersistedTrack = Track;

export interface PersistedState {
  tracks: PersistedTrack[];
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
