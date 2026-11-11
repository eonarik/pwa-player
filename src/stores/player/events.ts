// src/stores/player/events.ts

import type { Ref, ShallowRef } from 'vue';
import { audioService } from '@/services/audio/AudioService';
import { useHistoryStore } from '../history';
import { isLiveStream } from '@/plugins/registry';
import { telemetry } from '@/services/telemetry';
import type { Track } from '@/types/track';
import type { TrackId } from '@/types/ids';
import { logger } from '@/utils/logger';

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
  handleAuthError: (error: import('@/services/api/errors').AuthError, track: Track) => void;
  skipToNextOnError: () => void;
  getIsRestoring: () => boolean;
}

export interface AudioEvents {
  unsubscribeAll: () => void;
}

export function bindAudioEvents(refs: AudioEventsRefs, callbacks: AudioEventsCallbacks): AudioEvents {
  const { queue, currentIndex, currentTrack, isPlaying, duration, volume, muted } = refs;

  const unsubscribers: Array<() => void> = [];
  let trackStartedAt: number | null = null;

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
      trackStartedAt = performance.now();
      callbacks.startTimeLoop();

      if (callbacks.getIsRestoring()) return;

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
      const track = currentTrack.value;
      if (track && trackStartedAt !== null) {
        telemetry.event('track.end', {
          trackId: track.id,
          playedMs: Math.round(performance.now() - trackStartedAt),
        });
      }
      trackStartedAt = null;

      isPlaying.value = false;
      callbacks.stopTimeLoop();
      void callbacks.flushPlayback();
      callbacks.handleTrackEnd();
    }),

    audioService.on('volumechange', ({ volume: v, muted: m }) => {
      volume.value = v;
      muted.value = m;
    }),

    audioService.on('error', ({ message, src, code }) => {
      const track = currentTrack.value;

      telemetry.event('audio.error', {
        trackId: track?.id,
        kind: 'native',
        msg: message ? message.slice(0, 200) : 'unknown',
        code,
        srcKind: src.startsWith('blob:') ? 'blob' : src.includes('/api/') ? 'api' : 'url',
      });

      logger.error('[player] audio error:', message);
      isPlaying.value = false;
      callbacks.stopTimeLoop();

      // Никаких тостов здесь: единственный источник тоста
      // «Не удалось воспроизвести трек (все источники недоступны)» — playAt
      // (navigation.ts), который вызывается после reject play().
      //
      // Если play() упал — playAt поймает ошибку и сделает тост.
      // Если нативный error (без reject play()) — просто пропускаем трек.
      // handleAuthError сюда не приходит: AuthError летит из resolveTrackSource.
      callbacks.skipToNextOnError();
    }),
  );

  return {
    unsubscribeAll: () => {
      unsubscribers.forEach((fn) => fn());
      unsubscribers.length = 0;
    },
  };
}
