// src/stores/player/actions/navigation.ts

import { audioService } from '@/services/audio/AudioService';
import { resolveTrackSource } from '@/services/audio/resolveTrackSource';
import { toastService } from '@/services/ui/ToastService';
import { AuthError } from '@/services/api/errors';
import { isLiveStream } from '@/plugins/registry';
import { shuffleArray, findPlayableIndex, findFirstPlayableIndex } from '../playerHelpers';
import type { PlayerActionsRefs } from './types';
import type { Helpers } from './helpers';
import type { Errors } from './errors';

export function createNavigation(refs: PlayerActionsRefs, helpers: Helpers, errors: Errors) {
  const {
    queue,
    originalQueue,
    currentIndex,
    currentTrack,
    duration,
    currentTime,
    repeatMode,
    shuffle,
    playbackVersion,
  } = refs;
  const { shouldSkipAuto } = helpers;
  const { handleAuthError, skipToNextOnError } = errors;

  async function playAt(index: number): Promise<void> {
    const track = queue.value[index];
    if (!track) return;

    playbackVersion.value++;

    const sortedSources = [...track.sources].sort((a, b) => a.priority - b.priority);

    if (sortedSources.length === 0) {
      toastService.error('Не удалось воспроизвести трек (все источники недоступны)');

      if (queue.value.length > 1) {
        skipToNextOnError();
      } else {
        refs.isPlaying.value = false;
        audioService.pause();
        queue.value = [];
        originalQueue.value = [];
        currentIndex.value = -1;
        currentTrack.value = null;
        currentTime.value = 0;
        duration.value = 0;
      }
      return;
    }

    currentIndex.value = index;
    currentTrack.value = track;
    duration.value = 0;
    currentTime.value = 0;

    let lastError: Error | null = null;

    for (const source of sortedSources) {
      try {
        const resolved = await resolveTrackSource(track, source);
        audioService.load(resolved);
        await audioService.play();
        return;
      } catch (err) {
        if (err instanceof AuthError) {
          handleAuthError(err, track);
          return;
        }
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[player] Source ${source.id} failed, trying next...`, err);
      }
    }

    console.error('[player] All sources failed for track', track.id, lastError);
    toastService.error('Не удалось воспроизвести трек (все источники недоступны)');

    skipToNextOnError();
  }

  function next(): void {
    if (queue.value.length === 0) return;
    if (currentTrack.value && isLiveStream(currentTrack.value.pluginId)) return;
    const nextIndex = findPlayableIndex(queue.value, currentIndex.value + 1, 1, shouldSkipAuto);
    if (nextIndex !== -1) {
      void playAt(nextIndex);
      return;
    }
    if (repeatMode.value === 'all') {
      const wrapIndex = findPlayableIndex(queue.value, 0, 1, shouldSkipAuto);
      if (wrapIndex !== -1) {
        void playAt(wrapIndex);
        return;
      }
    }
    if (shuffle.value) {
      const currentId = currentTrack.value?.id;
      const rest = queue.value.filter((t) => t.id !== currentId);
      const reshuffled = shuffleArray(rest);
      if (reshuffled.length > 0) {
        queue.value = reshuffled;
        const firstPlayable = findFirstPlayableIndex(reshuffled, 0, shouldSkipAuto);
        if (firstPlayable !== -1) {
          void playAt(firstPlayable);
          return;
        }
      }
    }
    refs.isPlaying.value = false;
    audioService.pause();
  }

  function prev(): void {
    if (queue.value.length === 0) return;
    if (currentTrack.value && isLiveStream(currentTrack.value.pluginId)) return;
    if (audioService.currentTime > 3) {
      audioService.seek(0);
      return;
    }
    const prevIndex = findPlayableIndex(queue.value, currentIndex.value - 1, -1, shouldSkipAuto);
    if (prevIndex !== -1) {
      void playAt(prevIndex);
      return;
    }
    if (repeatMode.value === 'all') {
      const wrapIndex = findPlayableIndex(queue.value, queue.value.length - 1, -1, shouldSkipAuto);
      if (wrapIndex !== -1) {
        void playAt(wrapIndex);
        return;
      }
    }
    audioService.seek(0);
  }

  function toggleShuffle(): void {
    shuffle.value = !shuffle.value;
    if (queue.value.length <= 1) return;

    const current = queue.value[currentIndex.value];
    if (!current) return;

    if (shuffle.value) {
      const rest = queue.value.filter((t) => t.id !== current.id);
      queue.value = [current, ...shuffleArray(rest)];
      currentIndex.value = 0;
    } else {
      queue.value = [...originalQueue.value];
      const newIndex = queue.value.findIndex((t) => t.id === current.id);
      currentIndex.value = newIndex !== -1 ? newIndex : 0;
    }
  }

  function handleTrackEnd(): void {
    if (repeatMode.value === 'one') {
      audioService.seek(0);
      audioService.play().catch(() => {});
      return;
    }
    next();
  }

  return {
    playAt,
    next,
    prev,
    toggleShuffle,
    handleTrackEnd,
  };
}

export type Navigation = ReturnType<typeof createNavigation>;
