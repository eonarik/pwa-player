// src/types/metadata.ts

import type { MetadataCandidateId } from './ids';

/**
 * Снимок первичных метаданных. Заполняется ОДИН раз при первом парсинге
 * (из файла или из стриминга). При сбросе метаданные восстанавливаются из raw.
 *
 * coverUrl — только http(s):// (blob не сохраняем, после перезагрузки он мёртв).
 *
 * duration, codec, hasId3Tags — НЕ здесь, потому что они не меняются
 * (физические/вычисляемые). Они живут на Track.
 */
export interface RawMetadata {
  artist: string;
  title: string;
  album: string;
  coverUrl: string | null;
}

/**
 * Кандидат на метаданные из внешнего источника (iTunes, Deezer, Zvuk).
 * Появляется при fuzzy-мэтче: результат похож, но не равен оригиналу.
 * Пользователь подтверждает (применяем artist/title/album/coverUrl к треку)
 * или отклоняет.
 *
 * Обрати внимание: треки-дубликаты из библиотеки живут НЕ здесь, а в
 * `Track.duplicateTrackIds` (ссылка TrackId, данные резолвятся из библиотеки).
 *
 * `extMetadata` — произвольные данные провайдера. Ядро их не парсит и не
 * интерпретирует. Используются, чтобы провайдер мог применить свою
 * специфичную логику (например, Zvuk — добавить streaming-source).
 */
export interface MetadataCandidate {
  id: MetadataCandidateId;
  artist: string;
  title: string;
  album: string;
  coverUrl: string | null;
  /** 0..1 — насколько похоже на оригинал */
  similarity: number;
  /** Провайдер: 'itunes' | 'deezer' | 'zvuk' | любой другой */
  provider: string;
  /** Данные, уникальные для провайдера. Ядро не интерпретирует. */
  extMetadata?: Record<string, unknown>;
}

/** Уровень точности совпадения для отображения в UI (вместо процентов). */
export type SimilarityLevel = 'low' | 'medium' | 'high';

export function similarityLevel(similarity: number): SimilarityLevel {
  if (similarity >= 0.95) return 'high';
  if (similarity >= 0.85) return 'medium';
  return 'low';
}
