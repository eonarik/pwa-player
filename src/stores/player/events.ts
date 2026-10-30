// src/stores/player/events.ts

import type { Ref, ShallowRef } from 'vue';
import { audioService } from '@/services/audio/AudioService';
import { useHistoryStore } from '../history';
import { isLiveStream, pluginIdFromSource } from '@/plugins/registry';
import { apiClient } from '@/services/api/ApiClient';
import { AuthError } from '@/services/api/errors';
import { toastService } from '@/services/ui/ToastService';
import type { Track } from '@/types/track';
import type { TrackId } from '@/types/ids';

export interface AudioEventsRefs {
  queue: Ref<Track[]>;
  currentIndex: Ref<number>;
  currentTrack: ShallowRef<Track | null>;
  isPlaying: Ref<boolean>;
  duration: Ref<number>;
  volume: Ref<number>;
  muted: Ref<boolean>;
}

export interface AudioEventsCallbacks {
  startTimeLoop: () => void;
  stopTimeLoop: () => void;
  flushPlayback: () => Promise<void>;
  handleTrackEnd: () => void;
  updateTrackDuration: (trackId: TrackId, duration: number) => void;
  retryPlayback: () => void;
  handleAuthError: (error: AuthError, track: Track) => void;
  skipToNextOnError: () => void; // <--- ДОБАВЛЕНО
}

export interface AudioEvents {
  unsubscribeAll: () => void;
}

export function bindAudioEvents(refs: AudioEventsRefs, callbacks: AudioEventsCallbacks): AudioEvents {
  const { queue, currentIndex, currentTrack, isPlaying, duration, volume, muted } = refs;

  const unsubscribers: Array<() => void> = [];

  async function handleStreamError(track: Track, _error: { src: string; message: string }): Promise<void> {
    const source = track.sources[0];
    if (!source) return;

    const pluginId = pluginIdFromSource(source.pluginId);

    try {
      await apiClient.healthCheck(pluginId);
      // Если healthCheck прошел (сервер жив), но audio выдал ошибку — значит, битый файл или CORS.
      // Пытаемся переключиться на следующий.
      callbacks.skipToNextOnError();
    } catch (err) {
      if (err instanceof AuthError) {
        callbacks.handleAuthError(err, track);
        return;
      }

      // Любая другая ошибка (ServerError, NetworkError) — тоже переключаем трек
      console.error('[player] handleStreamError:', err);
      callbacks.skipToNextOnError();
    }
  }

  unsubscribers.push(
    audioService.on('loadedmetadata', ({ duration: d }) => {
      duration.value = d;
      const idx = currentIndex.value;
      const track = queue.value[idx];
      if (track && Math.abs((track.duration ?? 0) - d) > 0.5) {
        queue.value[idx] = { ...track, duration: d };
        if (track.sources[0]?.pluginId) {
          callbacks.updateTrackDuration(track.id, d);
        }
      }
    }),

    audioService.on('play', () => {
      if (audioService.paused) {
        isPlaying.value = false;
        return;
      }

      isPlaying.value = true;
      callbacks.startTimeLoop();
      const track = currentTrack.value;
      if (track && !isLiveStream(track.pluginId)) {
        void useHistoryStore().recordPlay(track);
      }
    }),

    audioService.on('pause', () => {
      isPlaying.value = false;
      void callbacks.flushPlayback();
    }),

    audioService.on('ended', () => {
      isPlaying.value = false;
      callbacks.stopTimeLoop();
      void callbacks.flushPlayback();
      callbacks.handleTrackEnd();
    }),

    audioService.on('volumechange', ({ volume: v, muted: m }) => {
      volume.value = v;
      muted.value = m;
    }),

    audioService.on('error', ({ message, src }) => {
      console.error('[player] audio error:', message);
      isPlaying.value = false;
      callbacks.stopTimeLoop();

      const track = currentTrack.value;
      if (!track) {
        toastService.error(message || 'Не удалось воспроизвести трек');
        return;
      }

      void handleStreamError(track, { src, message });
    }),
  );

  return {
    unsubscribeAll: () => {
      unsubscribers.forEach((fn) => fn());
      unsubscribers.length = 0;
    },
  };
}
