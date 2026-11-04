import type { Ref } from 'vue';
import { persistenceService } from '@/services/persistence/PersistenceService';
import type { PersistedPlayback, PersistedState } from '@/services/persistence/types';
import { telemetry } from '@/services/telemetry';
import { deepToRaw } from '@/utils/deepToRaw';
import type { Track } from '@/types/track';

export interface PlayerPersistenceRefs {
  queue: Ref<Track[]>;
  originalQueue: Ref<Track[]>;
  currentIndex: Ref<number>;
  currentTime: Ref<number>;
  volume: Ref<number>;
  muted: Ref<boolean>;
  repeatMode: Ref<'off' | 'one' | 'all'>;
  shuffle: Ref<boolean>;
  isPlaying: Ref<boolean>;
  currentTrack: Ref<Track | null>;
}

export interface PlayerPersistence {
  buildState(): PersistedState;
  buildPlayback(): PersistedPlayback;
  flushPlayback(): Promise<void>;
  flushState(): Promise<void>;
  subscribeFlushOnUnload(): () => void;
}

export function createPlayerPersistence(refs: PlayerPersistenceRefs): PlayerPersistence {
  const {
    queue,
    originalQueue,
    currentIndex,
    currentTime,
    volume,
    muted,
    repeatMode,
    shuffle,
    isPlaying,
    currentTrack,
  } = refs;

  function buildState(): PersistedState {
    const safeTracks = deepToRaw(queue.value);
    const safeOriginalTracks = deepToRaw(originalQueue.value);

    const state = {
      tracks: safeTracks,
      originalTracks: safeOriginalTracks,
      currentIndex: currentIndex.value,
      volume: volume.value,
      muted: muted.value,
      repeatMode: repeatMode.value,
      shuffle: shuffle.value,
      savedAt: Date.now(),
    };

    const sizeKB = Math.round(JSON.stringify(state).length / 1024);
    telemetry.event('idb.write', { key: 'player:state', sizeKB });

    return state;
  }

  function buildPlayback(): PersistedPlayback {
    return {
      currentTime: currentTime.value,
      trackId: currentTrack.value?.id ?? null,
      wasPlaying: isPlaying.value,
      savedAt: Date.now(),
    };
  }

  async function flushPlayback(): Promise<void> {
    await persistenceService.savePlaybackNow(buildPlayback());
  }

  async function flushState(): Promise<void> {
    await persistenceService.saveStateNow(buildState());
  }

  function subscribeFlushOnUnload(): () => void {
    if (typeof window === 'undefined') return () => {};

    const flush = (): void => {
      void flushState();
      void flushPlayback();
    };

    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  return {
    buildState,
    buildPlayback,
    flushPlayback,
    flushState,
    subscribeFlushOnUnload,
  };
}
