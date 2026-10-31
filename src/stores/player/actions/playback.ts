// src/stores/player/actions/playback.ts

import { audioService } from '@/services/audio/AudioService';
import { toastService } from '@/services/ui/ToastService';
import type { PlayerActionsRefs, PlayerActionsCallbacks } from './types';

export function createPlayback(refs: PlayerActionsRefs, callbacks: PlayerActionsCallbacks) {
  const { queue, originalQueue, currentTrack, isPlaying, duration, currentTime, repeatMode } = refs;
  const { stopTimeLoop, syncCurrentTime } = callbacks;

  function play(): void {
    if (currentTrack.value === null && queue.value.length > 0) {
      // Если нет текущего трека, но есть очередь — playAt(0) вызовет createNavigation.
      // Но чтобы не плодить циклические зависимости, мы просто вызываем play() из аудио,
      // а playAt должен быть вызван навигацией. (Раньше было void playAt(0), но тут мы просто пробуем).
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
    originalQueue.value = [];
    refs.currentIndex.value = -1;
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

  return {
    play,
    pause,
    stop,
    toggle,
    seek,
    seekBy,
    setVolume,
    setVolumeBy,
    toggleMute,
    cycleRepeat,
  };
}

export type Playback = ReturnType<typeof createPlayback>;
