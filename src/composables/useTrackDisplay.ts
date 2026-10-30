// src/composables/useTrackDisplay.ts

import { computed, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { useLibraryStore } from '@/stores/library';
import { getPluginName } from '@/plugins/lookup';
import type { Track } from '@/types/track';

export function useTrackDisplay(track: Ref<Track | null | undefined>) {
  const uiSettings = useUiSettingsStore();
  const { showSource } = storeToRefs(uiSettings);
  const library = useLibraryStore();

  const hasArtist = computed(() => Boolean(track.value?.artist?.trim()));
  const title = computed(() => track.value?.title ?? '');

  const subtitle = computed(() => {
    const t = track.value;
    if (!t) return '';
    if (!showSource.value) return '';

    const pluginId = t.pluginId;
    const pluginName = pluginId ? getPluginName(pluginId) : '<unknown>';

    const folderSource = t.sources.find((s) => s.kind === 'local' || s.kind === 'cloud');
    if (!folderSource) return `${pluginName}/<unknown_folder>`;

    const folder = library.getFolder(folderSource.folderId);
    if (!folder) return `${pluginName}/<unknown_folder>`;

    return `${pluginName}/${folder.name}`;
  });

  const hasSubtitle = computed(() => subtitle.value.length > 0);

  return { showSource, hasArtist, title, subtitle, hasSubtitle };
}
