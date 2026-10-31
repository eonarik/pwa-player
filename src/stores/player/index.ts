// src/stores/player/index.ts

import { defineStore } from 'pinia';
import { ref, computed, shallowRef, watch } from 'vue';
import { audioService } from '@/services/audio/AudioService';
import { persistenceService } from '@/services/persistence/PersistenceService';
import type { Track } from '@/types/track';
import type { TrackId } from '@/types/ids';
import { createLibraryWriter, useLibraryStore } from '../library';
import { createPlayerPersistence } from './playerPersistence';
import { restorePlayerState, applyRestoredPlayback } from './playerRestore';
import { createTimeLoop } from './timeLoop';
import { bindAudioEvents } from './events';
import { createPlayerActions } from './actions';

export const usePlayerStore = defineStore('player', () => {
  const queue = ref<Track[]>([]);
  const currentIndex = ref(-1);
  const isPlaying = ref(false);
  const duration = ref(0);
  const currentTime = ref(0);
  const volume = ref(1);
  const muted = ref(false);
  const repeatMode = ref<'off' | 'one' | 'all'>('off');
  const shuffle = ref(false);

  // Счетчик запусков трека для триггера автопоиска
  const playbackVersion = ref(0);

  const currentTrack = shallowRef<Track | null>(null);

  const timeLoop = createTimeLoop({ currentTime, isPlaying });

  const persistence = createPlayerPersistence({
    queue,
    currentIndex,
    currentTime,
    volume,
    muted,
    repeatMode,
    shuffle,
    currentTrack,
  });

  const { flushPlayback } = persistence;

  const actions = createPlayerActions(
    {
      queue,
      currentIndex,
      currentTrack,
      isPlaying,
      duration,
      currentTime,
      repeatMode,
      shuffle,
      playbackVersion,
    },
    { syncCurrentTime: timeLoop.syncOnce, stopTimeLoop: timeLoop.stop },
  );

  watch([queue, currentIndex, volume, muted, repeatMode, shuffle], () => {
    persistenceService.scheduleSaveState(persistence.buildState());
  });

  watch(currentTime, () => {
    persistenceService.scheduleSavePlayback(persistence.buildPlayback());
  });

  const libraryWriter = createLibraryWriter();

  const events = bindAudioEvents(
    { queue, currentIndex, currentTrack, isPlaying, duration, volume, muted },
    {
      startTimeLoop: timeLoop.start,
      stopTimeLoop: timeLoop.stop,
      flushPlayback,
      handleTrackEnd: actions.handleTrackEnd,
      updateTrackDuration: (trackId: TrackId, d: number) => libraryWriter.updateTrackMetadata(trackId, { duration: d }),
      retryPlayback: () => {
        if (currentIndex.value >= 0) void actions.playAt(currentIndex.value);
      },
      handleAuthError: (error, track) => actions.handleAuthError(error, track),
      skipToNextOnError: actions.skipToNextOnError,
    },
  );

  const unsubFlush = persistence.subscribeFlushOnUnload();

  const hasNext = computed(() => {
    if (queue.value.length === 0) return false;
    if (shuffle.value) return queue.value.length > 1;
    if (repeatMode.value === 'all') return true;
    return currentIndex.value < queue.value.length - 1;
  });

  const hasPrev = computed(() => {
    if (queue.value.length === 0) return false;
    if (shuffle.value) return queue.value.length > 1;
    if (repeatMode.value === 'all') return true;
    return currentIndex.value > 0;
  });

  const progress = computed(() => {
    if (!duration.value) return 0;
    return currentTime.value / duration.value;
  });

  async function restore(): Promise<boolean> {
    const restored = await restorePlayerState();
    if (!restored) return false;

    queue.value = restored.tracks;
    currentIndex.value = restored.currentIndex;
    currentTrack.value = restored.tracks[restored.currentIndex] ?? null;
    volume.value = restored.volume;
    muted.value = restored.muted;
    repeatMode.value = restored.repeatMode;
    shuffle.value = restored.shuffle;

    audioService.setVolume(restored.volume);
    audioService.setMuted(restored.muted);

    await applyRestoredPlayback(restored.tracks, restored.currentIndex, (t) => {
      currentTime.value = Math.round(t * 10) / 10;
    });

    return true;
  }

  function updateTrackInQueue(trackId: TrackId): void {
    const idx = queue.value.findIndex((t) => t.id === trackId);
    if (idx === -1) return;

    const libTrack = useLibraryStore().getTrack(trackId);
    if (!libTrack) return;

    queue.value[idx] = { ...queue.value[idx]!, ...libTrack };

    if (currentIndex.value === idx) {
      currentTrack.value = queue.value[idx]!;
    }
  }

  function $dispose(): void {
    timeLoop.stop();
    events.unsubscribeAll();
    unsubFlush();
  }

  return {
    queue,
    currentIndex,
    currentTrack,
    isPlaying,
    duration,
    currentTime,
    volume,
    muted,
    repeatMode,
    shuffle,
    playbackVersion,
    hasNext,
    hasPrev,
    progress,
    ...actions,
    restore,
    updateTrackInQueue,
    $dispose,
  };
});
