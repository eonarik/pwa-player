// src/composables/useTrackCapabilities.ts

import { computed, type Ref } from 'vue';
import type { Track } from '@/types/track';
import {
  isLinearContent,
  isLiveStream,
  isStreamingPlugin,
  pluginCanDownload,
  pluginIdFromSource,
} from '@/plugins/registry';

/**
 * Что разрешено делать с треком. Всё выводится из плагина первого (приоритетного)
 * источника: у радио- и подкаст-плагинов свои ограничения на скачивание и метаданные.
 */
export function useTrackCapabilities(track: Ref<Track>) {
  const primaryPluginId = computed(() =>
    track.value.sources[0] ? pluginIdFromSource(track.value.sources[0].pluginId) : '',
  );

  /** Линейный контент (радио/подкаст) — без реакций и ручной правки метаданных. */
  const isLinear = computed(() => isLinearContent(primaryPluginId.value));

  /** Прямой эфир — нельзя ни скачать, ни показать метаданные. */
  const isLive = computed(() => isLiveStream(primaryPluginId.value));

  /** Стриминг по URL — метаданные не редактируют, файлы не качают. */
  const isStreaming = computed(() => isStreamingPlugin(primaryPluginId.value));

  const canDownload = computed(() => {
    if (isLive.value || isStreaming.value) return false;
    const pluginId = primaryPluginId.value;
    if (!pluginId) return false;
    return pluginCanDownload(pluginId);
  });

  return { primaryPluginId, isLinear, isLive, isStreaming, canDownload };
}
