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
 * Кандидат на метаданные из внешнего источника (iTunes, Deezer).
 * Появляется при fuzzy-мэтче: результат похож, но не равен оригиналу.
 * Пользователь подтверждает (применяем artist/title/album/coverUrl к треку)
 * или отклоняет.
 */
export interface MetadataCandidate {
  id: MetadataCandidateId;
  artist: string;
  title: string;
  album: string;
  coverUrl: string | null;
  /** 0..1 — насколько похоже на оригинал */
  similarity: number;
  /** Провайдер: 'itunes' | 'deezer' | любой другой */
  provider: string;
}
