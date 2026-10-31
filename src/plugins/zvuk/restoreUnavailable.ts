// src/plugins/zvuk/restoreUnavailable.ts

import { loadPlugin } from '@/plugins/registry';
import { createLibraryWriter, useLibraryStore } from '@/stores/library';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { toastService } from '@/services/ui/ToastService';
import { newTrackSourceId } from '@/types/ids';
import type { Track, TrackSource } from '@/types/track';
import type { CollectionActionContext } from '../types';

const ZVUK_PLUGIN_ID = 'zvuk';
const ZVUK_SOURCE_PRIORITY = 30;
const CONCURRENCY = 1;
const DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function restoreUnavailableTracksInZvuk(tracks: Track[], ctx: CollectionActionContext): Promise<void> {
  const library = useLibraryStore();
  const uiSettings = useUiSettingsStore();
  const writer = createLibraryWriter();
  const zvukPlugin = await loadPlugin(ZVUK_PLUGIN_ID);

  if (!zvukPlugin.fetchMetadata) {
    toastService.error('Плагин Звук недоступен');
    return;
  }

  const candidates = tracks.filter((t) => t.sources.length === 0);
  if (candidates.length === 0) {
    toastService.info('Нет треков без источника');
    return;
  }

  const threshold = uiSettings.metadataThreshold;
  let found = 0;
  let processed = 0;
  let cursor = 0;
  let aborted = false;

  ctx.setProgress({ done: 0, total: candidates.length, found: 0 });

  const worker = async (): Promise<void> => {
    while (cursor < candidates.length) {
      if (aborted) return;
      const index = cursor++;
      const track = candidates[index]!;

      try {
        const libTrack = library.getTrack(track.id);
        if (!libTrack || libTrack.sources.length > 0) {
          processed++;
          continue;
        }

        const data = await zvukPlugin.fetchMetadata?.(libTrack.artist, libTrack.title);

        if (data && data.confident && data.similarity >= threshold && data.extMetadata?.trackId) {
          const zvukTrackId = String(data.extMetadata.trackId);
          const source: TrackSource = {
            id: newTrackSourceId(),
            pluginId: ZVUK_PLUGIN_ID,
            priority: ZVUK_SOURCE_PRIORITY,
            kind: 'streaming',
            url: `/api/zvuk/stream?id=${encodeURIComponent(zvukTrackId)}`,
          };
          writer.updateTrackSources(libTrack.id, [source]);
          found++;
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'ZVUK_RATE_LIMIT') {
          aborted = true;
          toastService.error('Звук ограничил доступ. Подождите несколько минут и попробуйте снова.');
          return;
        }
        console.warn(`[zvuk-restore] failed for "${track.title}"`, err);
      } finally {
        processed++;
        ctx.setProgress({ done: processed, total: candidates.length, found });
        if (!aborted && processed < candidates.length) {
          await sleep(DELAY_MS);
        }
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, () => worker()));
  } finally {
    ctx.setProgress(null);
  }

  if (aborted) {
    return;
  }

  if (found > 0) {
    toastService.success(`Найдено в Звуке: ${found} из ${candidates.length}`);
  } else {
    toastService.info(`В Звуке не найдено ни одного трека (проверено: ${candidates.length})`);
  }
}
