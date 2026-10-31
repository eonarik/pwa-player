// src/stores/player/actions/queue.ts

import { shuffleArray, findFirstPlayableIndex } from '../playerHelpers';
import { toastService } from '@/services/ui/ToastService';
import { pluginIdFromSource } from '@/plugins/registry';
import type { Track } from '@/types/track';
import type { PlayerActionsRefs } from './types';
import type { Helpers } from './helpers';

export function createQueue(
  refs: PlayerActionsRefs,
  helpers: Helpers,
  callPlayAt: (idx: number) => Promise<void>,
  callStop: () => void,
) {
  const { queue, originalQueue, currentIndex, currentTrack, shuffle } = refs;
  const { shouldSkipAuto } = helpers;

  function setQueue(tracks: Track[], startIndex = 0): void {
    if (tracks.length === 0) {
      queue.value = [];
      originalQueue.value = [];
      currentIndex.value = -1;
      currentTrack.value = null;
      return;
    }

    const fromIndex = Math.min(Math.max(startIndex, 0), tracks.length - 1);
    const clicked = tracks[fromIndex];
    if (!clicked) return;

    originalQueue.value = [...tracks];

    if (shuffle.value) {
      const rest = tracks.filter((_, i) => i !== fromIndex);
      queue.value = [clicked, ...shuffleArray(rest)];
      void callPlayAt(0);
    } else {
      queue.value = [...tracks];
      void callPlayAt(fromIndex);
    }
  }

  function playAll(tracks: Track[]): void {
    if (tracks.length === 0) return;

    originalQueue.value = [...tracks];

    if (shuffle.value) {
      const shuffled = shuffleArray(tracks);
      const firstPlayable = findFirstPlayableIndex(shuffled, 0, shouldSkipAuto);
      queue.value = shuffled;
      if (firstPlayable === -1) {
        toastService.error('Все треки недоступны. Подключите плагин или скачайте треки.');
        return;
      }
      void callPlayAt(firstPlayable);
    } else {
      const firstPlayable = findFirstPlayableIndex(tracks, 0, shouldSkipAuto);
      queue.value = [...tracks];
      if (firstPlayable === -1) {
        toastService.error('Все треки недоступны. Подключите плагин или скачайте треки.');
        return;
      }
      void callPlayAt(firstPlayable);
    }
  }

  function removeFromQueue(index: number): void {
    if (index < 0 || index >= queue.value.length) return;
    const wasCurrent = index === currentIndex.value;
    const wasBeforeCurrent = index < currentIndex.value;

    const removedTrack = queue.value[index];

    queue.value = queue.value.filter((_, i) => i !== index);
    if (removedTrack) {
      originalQueue.value = originalQueue.value.filter((t) => t.id !== removedTrack.id);
    }

    if (queue.value.length === 0) {
      callStop();
      return;
    }
    if (wasCurrent) {
      const nextIndex = Math.min(index, queue.value.length - 1);
      void callPlayAt(nextIndex);
    } else if (wasBeforeCurrent) {
      currentIndex.value = currentIndex.value - 1;
      currentTrack.value = queue.value[currentIndex.value] ?? null;
    }
  }

  function clearQueue(): void {
    callStop();
  }

  function removeTracksByPlugin(pluginId: string): void {
    const tracksToRemove = queue.value.filter((track) => {
      return track.sources.every((s) => pluginIdFromSource(s.pluginId) === pluginId);
    });

    if (tracksToRemove.length === 0) return;

    if (currentTrack.value && tracksToRemove.some((t) => t.id === currentTrack.value?.id)) {
      callStop();
      return;
    }

    queue.value = queue.value.filter((t) => !tracksToRemove.some((tr) => tr.id === t.id));
    originalQueue.value = originalQueue.value.filter((t) => !tracksToRemove.some((tr) => tr.id === t.id));

    if (currentIndex.value >= queue.value.length) {
      currentIndex.value = queue.value.length - 1;
    }
  }

  return { setQueue, playAll, removeFromQueue, clearQueue, removeTracksByPlugin };
}

export type Queue = ReturnType<typeof createQueue>;
