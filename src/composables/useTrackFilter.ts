// src/composables/useTrackFilter.ts

import { computed, ref, type Ref, type ComputedRef } from 'vue';
import { getPluginName } from '@/plugins/lookup';
import { pluginIdFromSource } from '@/plugins/registry';
import type { FilterOption } from '@/types/filter';
import type { Track } from '@/types/track';

export interface UseTrackFilterReturn {
  sourceFilter: Ref<string>;
  preFilteredTracks: ComputedRef<Track[]>;
  filterOptions: ComputedRef<FilterOption[]>;
  filteredTracks: ComputedRef<Track[]>;
}

export function useTrackFilter(
  tracks: Ref<Track[]>,
  preFilter?: (t: Track) => boolean,
): UseTrackFilterReturn {
  const sourceFilter = ref<string>('all');

  const preFilteredTracks = computed<Track[]>(() => {
    if (!preFilter) return tracks.value;
    return tracks.value.filter(preFilter);
  });

  const filterOptions = computed<FilterOption[]>(() => {
    const plugins = new Set<string>();
    for (const t of preFilteredTracks.value) {
      const pid = t.pluginId;
      if (pid && pid !== 'imported') {
        plugins.add(pluginIdFromSource(pid));
      }
    }
    return Array.from(plugins).map((id) => ({
      id,
      label: getPluginName(id),
    }));
  });

  const filteredTracks = computed<Track[]>(() => {
    if (sourceFilter.value === 'all') return preFilteredTracks.value;
    return preFilteredTracks.value.filter((t) => {
      const pid = pluginIdFromSource(t.pluginId);
      if (pid === 'imported') return false;
      return pid === sourceFilter.value;
    });
  });

  return {
    sourceFilter,
    preFilteredTracks,
    filterOptions,
    filteredTracks,
  };
}
