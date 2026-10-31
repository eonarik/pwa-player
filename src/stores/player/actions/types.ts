// src/stores/player/actions/types.ts

import type { Ref, ShallowRef } from 'vue';
import type { Track } from '@/types/track';
import type { AuthError } from '@/services/api/errors';

export interface PlayerActionsRefs {
  queue: Ref<Track[]>;
  originalQueue: Ref<Track[]>;
  currentIndex: Ref<number>;
  currentTrack: ShallowRef<Track | null>;
  isPlaying: Ref<boolean>;
  duration: Ref<number>;
  currentTime: Ref<number>;
  repeatMode: Ref<'off' | 'one' | 'all'>;
  shuffle: Ref<boolean>;
  playbackVersion: Ref<number>;
}

export interface PlayerActionsCallbacks {
  syncCurrentTime: () => void;
  stopTimeLoop: () => void;
}

export interface PlayerActions {
  setQueue: (tracks: Track[], startIndex?: number) => void;
  playAll: (tracks: Track[]) => void;
  playAt: (index: number) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  seekBy: (delta: number) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setVolume: (v: number) => void;
  setVolumeBy: (delta: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  handleTrackEnd: () => void;
  handleAuthError: (error: AuthError, track: Track) => void;
  skipToNextOnError: () => void;
  removeTracksByPlugin: (pluginId: string) => void;
}

export type ShouldSkipFn = (track: Track) => boolean;
