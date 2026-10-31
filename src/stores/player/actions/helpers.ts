// src/stores/player/actions/helpers.ts

import { useDislikesStore } from '@/stores/dislikes';
import { getPlayability } from '@/services/library/selectors';
import { isPluginDisconnected, pluginIdFromSource } from '@/plugins/registry';
import type { Track } from '@/types/track';
import type { ShouldSkipFn } from './types';

export function createHelpers() {
  function isAnyPluginDisconnected(track: Track): boolean {
    const cloudSources = track.sources.filter((s) => s.kind === 'cloud');
    if (cloudSources.length === 0) return false;
    return cloudSources.some((s) => isPluginDisconnected(pluginIdFromSource(s.pluginId)));
  }

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

  return { shouldSkipAuto, isAnyPluginDisconnected };
}

export type Helpers = ReturnType<typeof createHelpers>;
export type { ShouldSkipFn };
