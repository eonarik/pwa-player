// src/composables/useTrackEndOnVisibility.ts

import { onMounted, onUnmounted } from 'vue';
import { usePlayerStore } from '@/stores/player';
import { audioService } from '@/services/audio/AudioService';

/**
 * При возврате на вкладку, если трек закончился (или почти закончился),
 * а браузер не выстрелил `ended` (бывает в фоне) — обрабатываем конец вручную.
 */
export function useTrackEndOnVisibility() {
  const player = usePlayerStore();

  function handleVisibilityChange() {
    if (document.visibilityState !== 'visible') return;
    if (!player.isPlaying) return;

    const audio = audioService.element;
    const ended = audio.ended || (audio.duration > 0 && audio.currentTime >= audio.duration - 0.5);
    if (ended) player.handleTrackEnd();
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });
}
