// src/services/metadata/MetadataService/apply/candidate.ts

import { loadPlugin } from '@/plugins/registry';
import type { TrackId } from '@/types/ids';
import type { MetadataCandidate } from '@/types/metadata';
import { logger } from '@/utils/logger';
import type { ManualPatch } from '../types';
import type { ManualApply } from './manual';

/**
 * Подтверждение внешнего кандидата пользователем.
 *
 * Треки-дубликаты из библиотеки живут в `Track.duplicateTrackIds` и
 * сливаются отдельным потоком (модалка «Похожие треки»). Здесь только
 * внешние снимки метаданных от провайдеров.
 */
export function createCandidateApply(manual: ManualApply) {
  /** Кандидат в форме ручного патча: artist/title/album/coverUrl. */
  function toManualPatch(candidate: MetadataCandidate): ManualPatch {
    return {
      artist: candidate.artist,
      title: candidate.title,
      album: candidate.album,
      coverUrl: candidate.coverUrl ?? undefined,
    };
  }

  async function applyCandidate(trackId: TrackId, candidate: MetadataCandidate): Promise<void> {
    manual.updateManual(trackId, toManualPatch(candidate));

    if (candidate.extMetadata) {
      await invokeApplyCandidate(candidate.provider, trackId, candidate.extMetadata);
    }
  }

  /**
   * Позволяет провайдеру доприменить свою специфику (например, Zvuk добавляет
   * streaming-source). Ошибка плагина не отменяет уже применённые метаданные.
   */
  async function invokeApplyCandidate(
    provider: string,
    trackId: TrackId,
    extMetadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      const plugin = await loadPlugin(provider);

      if (plugin.isDisconnected?.()) {
        return;
      }

      if (!plugin.applyCandidate) {
        return;
      }

      await plugin.applyCandidate(trackId, extMetadata);
    } catch (err) {
      logger.error(`[metadata] applyCandidate failed for provider "${provider}"`, err);
    }
  }

  return { applyCandidate, invokeApplyCandidate };
}

export type CandidateApply = ReturnType<typeof createCandidateApply>;
