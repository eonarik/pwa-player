// src/services/metadata/MetadataService/apply/duplicates.ts

import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import type { TrackId } from '@/types/ids';
import { mergeTrackInto } from './merge';

/**
 * Выбор основного трека в группе дубликатов.
 *
 * Дефолт: title короче (после нормализации), при равенстве — больше sources.
 * Используется модалкой «Похожие треки» для предвыбора radio-кнопки.
 */
export function pickPrimaryTrackId(ids: TrackId[]): TrackId | null {
  const library = useLibraryStore();

  let best: TrackId | null = null;
  let bestLen = Number.POSITIVE_INFINITY;
  let bestSources = -1;

  for (const id of ids) {
    const track = library.tracks[id];
    if (!track) continue;

    const len = track.title.trim().length;
    const srcCount = track.sources.length;

    if (len < bestLen || (len === bestLen && srcCount > bestSources)) {
      best = id;
      bestLen = len;
      bestSources = srcCount;
    }
  }

  return best;
}

/**
 * Применение группы дубликатов: выбранный основной принимает в себя все
 * остальные треки группы. После слияния у основного чистим duplicateTrackIds
 * (связь потеряла смысл — дублей больше нет).
 */
export function applyDuplicates(primaryId: TrackId, duplicateIds: TrackId[]): void {
  const library = useLibraryStore();
  const writer = createLibraryWriter();

  // Аккумулятор объединённых sources — после каждого mergeTrackInto primary
  // перезаписывается в сторе новым объектом с слитыми источниками, поэтому
  // перечитываем его перед следующим прогоном цикла.
  for (const dupId of duplicateIds) {
    if (dupId === primaryId) continue;
    const currentPrimary = library.getTrack(primaryId);
    const dup = library.getTrack(dupId);
    if (!currentPrimary || !dup) continue;

    // mergeTrackInto объединяет sources, перевешивает плейлисты/историю и
    // удаляет дубль. Он не трогает duplicateTrackIds — чистим ниже.
    mergeTrackInto(dup, currentPrimary);
  }

  const finalPrimary = library.getTrack(primaryId);
  if (!finalPrimary) return;

  // Удаляем из duplicateTrackIds ссылки на слитые дубли и чистим
  // обратные ссылки у выживших соседей по группе (если группа шире пары).
  const merged = new Set<TrackId>(duplicateIds);
  merged.add(primaryId);

  const nextPrimaryDups = finalPrimary.duplicateTrackIds.filter((id) => !merged.has(id));
  if (nextPrimaryDups.length !== finalPrimary.duplicateTrackIds.length) {
    writer.updateTrackDuplicates(primaryId, nextPrimaryDups);
  }

  // Обратные ссылки: любой трек, который ссылался на удалённые дубли, теперь
  // должен ссылаться на primary (дубли могли быть связаны не только с ним).
  for (const survivorId of nextPrimaryDups) {
    const survivor = library.getTrack(survivorId);
    if (!survivor) continue;

    const hadMerged = survivor.duplicateTrackIds.some((id) => merged.has(id));
    if (!hadMerged) continue;

    const cleaned = survivor.duplicateTrackIds.filter((id) => !merged.has(id));
    const withPrimary = cleaned.includes(primaryId) ? cleaned : [...cleaned, primaryId];
    writer.updateTrackDuplicates(survivorId, withPrimary);
  }
}
