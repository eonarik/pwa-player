// src/stores/player/actions/index.ts

import type { PlayerActionsRefs, PlayerActionsCallbacks, PlayerActions } from './types';
import { createHelpers } from './helpers';
import { createPlayback } from './playback';
import { createErrors } from './errors';
import { createQueue } from './queue';
import { createNavigation } from './navigation';

export * from './types';

export function createPlayerActions(refs: PlayerActionsRefs, callbacks: PlayerActionsCallbacks): PlayerActions {
  const helpers = createHelpers();

  // 1. Создаём playback (play/pause/stop)
  const playback = createPlayback(refs, callbacks);

  // 2. Создаём queue (setQueue/playAll). Ей нужен callPlayAt, который появится в navigation.
  //    Используем замыкание: callPlayAt будет вызван позже.
  let playAtRef: (idx: number) => Promise<void> = async () => {};

  const queue = createQueue(refs, helpers, (idx) => playAtRef(idx), playback.stop);

  // 3. Создаём errors (handleAuthError/skipToNextOnError). Ей нужен playAt.
  const errors = createErrors(refs, helpers, (idx) => playAtRef(idx));

  // 4. Создаём navigation (playAt/next/prev). Ей нужны errors.
  const navigation = createNavigation(refs, helpers, errors);

  // Присваиваем реальный playAt
  playAtRef = navigation.playAt;

  // 5. Обёртка для play(), чтобы вызвать playAt(0), если очередь есть, а трека нет.
  const playWrapper = (): void => {
    if (refs.currentTrack.value === null && refs.queue.value.length > 0) {
      void navigation.playAt(0);
      return;
    }
    playback.play();
  };

  return {
    setQueue: queue.setQueue,
    playAll: queue.playAll,
    removeFromQueue: queue.removeFromQueue,
    clearQueue: queue.clearQueue,
    removeTracksByPlugin: queue.removeTracksByPlugin,

    playAt: navigation.playAt,
    next: navigation.next,
    prev: navigation.prev,
    toggleShuffle: navigation.toggleShuffle,
    handleTrackEnd: navigation.handleTrackEnd,

    play: playWrapper,
    pause: playback.pause,
    stop: playback.stop,
    toggle: playback.toggle,
    seek: playback.seek,
    seekBy: playback.seekBy,
    setVolume: playback.setVolume,
    setVolumeBy: playback.setVolumeBy,
    toggleMute: playback.toggleMute,
    cycleRepeat: playback.cycleRepeat,

    handleAuthError: errors.handleAuthError,
    skipToNextOnError: errors.skipToNextOnError,
  };
}
