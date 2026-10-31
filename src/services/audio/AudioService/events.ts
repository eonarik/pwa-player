// src/services/audio/audioService/events.ts

import type { AudioEventMap, AudioEventName } from '../types';

export interface NativeEventHandlers {
  /**
   * Отвязывает все нативные обработчики от audio.
   */
  dispose(): void;
}

/**
 * Привязывает нативные события HTMLAudioElement к универсальному эмиттеру.
 * Возвращает объект для отвязки.
 */
export function bindNativeEvents(
  audio: HTMLAudioElement,
  emit: <K extends AudioEventName>(event: K, payload: AudioEventMap[K]) => void,
): NativeEventHandlers {
  const handlers: Array<{ event: string; handler: EventListener }> = [];

  const bind = <K extends AudioEventName>(nativeEvent: string, emitName: K, map: () => AudioEventMap[K]) => {
    const handler: EventListener = () => {
      emit(emitName, map());
    };
    audio.addEventListener(nativeEvent, handler);
    handlers.push({ event: nativeEvent, handler });
  };

  bind('timeupdate', 'timeupdate', () => ({
    currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
    duration: Number.isFinite(audio.duration) ? audio.duration : 0,
  }));

  bind('loadedmetadata', 'loadedmetadata', () => ({
    duration: Number.isFinite(audio.duration) ? audio.duration : 0,
  }));

  bind('play', 'play', () => undefined as void);
  bind('pause', 'pause', () => undefined as void);
  bind('ended', 'ended', () => undefined as void);
  bind('waiting', 'waiting', () => undefined as void);
  bind('canplay', 'canplay', () => undefined as void);

  bind('volumechange', 'volumechange', () => ({
    volume: audio.volume,
    muted: audio.muted,
  }));

  const errorHandler: EventListener = () => {
    const mediaError = audio.error;
    emit('error', {
      message: mediaError?.message || 'Media error',
      code: mediaError?.code,
      src: audio.src,
    });
  };
  audio.addEventListener('error', errorHandler);
  handlers.push({ event: 'error', handler: errorHandler });

  return {
    dispose() {
      for (const { event, handler } of handlers) {
        audio.removeEventListener(event, handler);
      }
      handlers.length = 0;
    },
  };
}
