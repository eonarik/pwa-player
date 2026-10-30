// src/stores/player/actions.ts

import type { Ref, ShallowRef } from 'vue';
import { audioService } from '@/services/audio/AudioService';
import { resolveTrackSource } from '@/services/audio/resolveTrackSource';
import { getPlayability } from '@/services/library/selectors';
import { AuthError } from '@/services/api/errors';
import { apiClient } from '@/services/api/ApiClient';
import { connectPlugin } from '@/services/plugins/connectPlugin';
import { pluginIdFromSource, isLiveStream, isPluginDisconnected } from '@/plugins/registry';
import { toastService } from '@/services/ui/ToastService';
import { useDislikesStore } from '../dislikes';
import { shuffleArray, findFirstPlayableIndex, findPlayableIndex } from './playerHelpers';
import type { Track } from '@/types/track';

export interface PlayerActionsRefs {
  queue: Ref<Track[]>;
  currentIndex: Ref<number>;
  currentTrack: ShallowRef<Track | null>;
  isPlaying: Ref<boolean>;
  duration: Ref<number>;
  currentTime: Ref<number>;
  repeatMode: Ref<'off' | 'one' | 'all'>;
  shuffle: Ref<boolean>;
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
  skipToNextOnError: () => void; // <--- ДОБАВЛЕНО
}

export function createPlayerActions(refs: PlayerActionsRefs, callbacks: PlayerActionsCallbacks): PlayerActions {
  const { queue, currentIndex, currentTrack, isPlaying, duration, currentTime, repeatMode, shuffle } = refs;

  const { syncCurrentTime, stopTimeLoop } = callbacks;

  function shouldSkipAuto(track: Track): boolean {
    const dislikes = useDislikesStore();
    if (dislikes.isDisliked(track.id)) return true;

    const playability = getPlayability(track, {
      isPluginDisconnected: isAnyPluginDisconnected(track),
      isDownloading: false,
    });
    if (playability === 'missing') return true;
    return false;
  }

  function isAnyPluginDisconnected(track: Track): boolean {
    const cloudSources = track.sources.filter((s) => s.kind === 'cloud');
    if (cloudSources.length === 0) return false;
    return cloudSources.some((s) => isPluginDisconnected(pluginIdFromSource(s.pluginId)));
  }

  function handleAuthError(error: AuthError, track: Track): void {
    const pluginId = track.sources[0] ? pluginIdFromSource(track.sources[0].pluginId) : '';
    if (!pluginId) return;
    const provider = apiClient.getProvider(pluginId);
    const hasRefresh = provider?.hasRefreshToken() ?? false;
    const message =
      error.reason === 'refresh-expired' || (error.reason === 'no-refresh-token' && hasRefresh)
        ? 'Сессия истекла. Подключить источник заново?'
        : 'Источник не подключён. Подключить?';

    toastService.showPersistent(message, 'error', {
      label: 'Подключить',
      onAction: () => {
        void (async () => {
          try {
            const connected = await connectPlugin(pluginId);
            if (!connected) return;
            const idx = currentIndex.value;
            if (idx >= 0) await playAt(idx);
          } catch (err) {
            console.error('[player] handleAuthError: connectPlugin failed', err);
            toastService.error('Не удалось подключить источник');
          }
        })();
      },
    });
  }

  async function playAt(index: number): Promise<void> {
    const track = queue.value[index];
    if (!track) return;

    const sortedSources = [...track.sources].sort((a, b) => a.priority - b.priority);

    if (sortedSources.length === 0) {
      toastService.error('Источник недоступен. Нет доступных ссылок.');
      if (queue.value.length > 1) {
        next();
      } else {
        stop();
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

    // Пытаемся переключить на следующий
    skipToNextOnError();
  }

  function setQueue(tracks: Track[], startIndex = 0): void {
    if (tracks.length === 0) {
      queue.value = [];
      currentIndex.value = -1;
      currentTrack.value = null;
      return;
    }

    const fromIndex = Math.min(Math.max(startIndex, 0), tracks.length - 1);
    const clicked = tracks[fromIndex];
    if (!clicked) return;

    if (shuffle.value) {
      const rest = tracks.filter((_, i) => i !== fromIndex);
      const shuffledRest = shuffleArray(rest);
      queue.value = [clicked, ...shuffledRest];
      void playAt(0);
    } else {
      queue.value = tracks;
      void playAt(fromIndex);
    }
  }

  function playAll(tracks: Track[]): void {
    if (tracks.length === 0) return;

    if (shuffle.value) {
      const shuffled = shuffleArray(tracks);
      const firstPlayable = findFirstPlayableIndex(shuffled, 0, shouldSkipAuto);
      queue.value = shuffled;
      if (firstPlayable === -1) {
        toastService.error('Все треки недоступны. Подключите плагин или скачайте треки.');
        return;
      }
      void playAt(firstPlayable);
    } else {
      const firstPlayable = findFirstPlayableIndex(tracks, 0, shouldSkipAuto);
      queue.value = tracks;
      if (firstPlayable === -1) {
        toastService.error('Все треки недоступны. Подключите плагин или скачайте треки.');
        return;
      }
      void playAt(firstPlayable);
    }
  }

  function play(): void {
    if (currentTrack.value === null && queue.value.length > 0) {
      void playAt(0);
      return;
    }
    const track = currentTrack.value;
    if (track && track.sources.length === 0) {
      toastService.error('Источник недоступен. Подключите плагин или скачайте трек.');
      return;
    }
    audioService.play().catch((err) => {
      console.error('[player] play rejected', err);
    });
  }

  function pause(): void {
    audioService.pause();
  }

  function stop(): void {
    audioService.unload();
    audioService.pause();
    queue.value = [];
    currentIndex.value = -1;
    currentTrack.value = null;
    currentTime.value = 0;
    duration.value = 0;
    isPlaying.value = false;
    stopTimeLoop();
  }

  function toggle(): void {
    if (isPlaying.value) pause();
    else play();
  }

  function removeFromQueue(index: number): void {
    if (index < 0 || index >= queue.value.length) return;
    const wasCurrent = index === currentIndex.value;
    const wasBeforeCurrent = index < currentIndex.value;
    queue.value = queue.value.filter((_, i) => i !== index);
    if (queue.value.length === 0) {
      stop();
      return;
    }
    if (wasCurrent) {
      const nextIndex = Math.min(index, queue.value.length - 1);
      void playAt(nextIndex);
    } else if (wasBeforeCurrent) {
      currentIndex.value = currentIndex.value - 1;
      currentTrack.value = queue.value[currentIndex.value] ?? null;
    }
  }

  function clearQueue(): void {
    stop();
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
    isPlaying.value = false;
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

  function seek(time: number): void {
    audioService.seek(time);
    syncCurrentTime();
  }

  function seekBy(delta: number): void {
    seek(audioService.currentTime + delta);
  }

  function setVolume(v: number): void {
    audioService.setVolume(v);
  }

  function setVolumeBy(delta: number): void {
    audioService.setVolume(audioService.volume + delta);
  }

  function toggleMute(): void {
    audioService.setMuted(!audioService.muted);
  }

  function cycleRepeat(): void {
    repeatMode.value = repeatMode.value === 'off' ? 'all' : repeatMode.value === 'all' ? 'one' : 'off';
  }

  function toggleShuffle(): void {
    shuffle.value = !shuffle.value;
    if (shuffle.value && queue.value.length > 1) {
      const current = queue.value[currentIndex.value];
      if (!current) return;
      const played = queue.value.slice(0, currentIndex.value + 1);
      const remaining = queue.value.slice(currentIndex.value + 1);
      if (remaining.length === 0) return;
      queue.value = [...played, ...shuffleArray(remaining)];
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

  function skipToNextOnError(): void {
    // Если очередь пуста или мы на последнем треке без повтора — просто пауза
    const nextIndex = findPlayableIndex(queue.value, currentIndex.value + 1, 1, shouldSkipAuto);

    if (nextIndex !== -1) {
      void playAt(nextIndex);
      return;
    }

    // Если стоит повтор всех, идем в начало
    if (repeatMode.value === 'all') {
      const wrapIndex = findPlayableIndex(queue.value, 0, 1, shouldSkipAuto);
      if (wrapIndex !== -1) {
        void playAt(wrapIndex);
        return;
      }
    }

    // Если ничего не вышло — пауза
    isPlaying.value = false;
    audioService.pause();
  }

  return {
    setQueue,
    playAll,
    playAt,
    play,
    pause,
    stop,
    toggle,
    next,
    prev,
    seek,
    seekBy,
    removeFromQueue,
    clearQueue,
    setVolume,
    setVolumeBy,
    toggleMute,
    cycleRepeat,
    toggleShuffle,
    handleTrackEnd,
    handleAuthError,
    skipToNextOnError,
  };
}
