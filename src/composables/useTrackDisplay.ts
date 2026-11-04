// src/composables/useTrackDisplay.ts

import { computed, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { getPluginName } from '@/plugins/lookup';
import type { Track } from '@/types/track';

export function useTrackDisplay(track: Ref<Track | null | undefined>) {
  const uiSettings = useUiSettingsStore();
  const { showSource } = storeToRefs(uiSettings);

  const hasArtist = computed(() => Boolean(track.value?.artist?.trim()));
  const title = computed(() => track.value?.title ?? '');

  const subtitle = computed(() => {
    const t = track.value;
    if (!t) return '';
    if (!showSource.value) return '';

    const pluginNames = new Set<string>();
    for (const s of t.sources) {
      pluginNames.add(getPluginName(s.pluginId));
    }
    if (pluginNames.size === 0) return '';
    return Array.from(pluginNames).join(', ');
  });

  const hasSubtitle = computed(() => subtitle.value.length > 0);

  return { showSource, hasArtist, title, subtitle, hasSubtitle };
}
