// src/stores/player/actions/errors.ts

import { apiClient } from '@/services/api/ApiClient';
import { AuthError } from '@/services/api/errors';
import { pluginIdFromSource } from '@/plugins/registry';
import { connectPlugin } from '@/services/plugins/connectPlugin';
import { toastService } from '@/services/ui/ToastService';
import { findPlayableIndex } from '../playerHelpers';
import type { Track } from '@/types/track';
import type { PlayerActionsRefs } from './types';

export function createErrors(
  refs: PlayerActionsRefs,
  helpers: import('./helpers').Helpers,
  callPlayAt: (idx: number) => Promise<void>,
) {
  const { queue, currentIndex, isPlaying, repeatMode } = refs;
  const { shouldSkipAuto } = helpers;

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
            if (idx >= 0) await callPlayAt(idx);
          } catch (err) {
            console.error('[player] handleAuthError: connectPlugin failed', err);
            toastService.error('Не удалось подключить источник');
          }
        })();
      },
    });
  }

  function skipToNextOnError(): void {
    const nextIndex = findPlayableIndex(queue.value, currentIndex.value + 1, 1, shouldSkipAuto);
    if (nextIndex !== -1) {
      void callPlayAt(nextIndex);
      return;
    }
    if (repeatMode.value === 'all') {
      const wrapIndex = findPlayableIndex(queue.value, 0, 1, shouldSkipAuto);
      if (wrapIndex !== -1) {
        void callPlayAt(wrapIndex);
        return;
      }
    }
    isPlaying.value = false;
    import('@/services/audio/AudioService').then(({ audioService }) => audioService.pause());
  }

  return { handleAuthError, skipToNextOnError };
}

export type Errors = ReturnType<typeof createErrors>;
