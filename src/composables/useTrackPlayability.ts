// src/composables/useTrackPlayability.ts

import { computed, type Ref } from 'vue';
import type { Track } from '@/types/track';
import type { Playability } from '@/types/playability';
import { getPlayability } from '@/services/library/selectors';
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator';
import { isPluginDisconnected, pluginIdFromSource } from '@/plugins/registry';

export function useTrackPlayability(track: Ref<Track | null | undefined>) {
  return computed<Playability>(() => {
    const t = track.value;
    if (!t) return 'missing';

    const cloudSources = t.sources.filter((s) => s.kind === 'cloud');
    const isPluginDisconnectedValue = cloudSources.some((s) => isPluginDisconnected(pluginIdFromSource(s.pluginId)));

    return getPlayability(t, {
      isPluginDisconnected: isPluginDisconnectedValue,
      isDownloading: downloadOrchestrator.isDownloading(t.id),
    });
  });
}
