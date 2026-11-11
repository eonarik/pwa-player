// src/components/library/metadata/candidateLabels.ts

import type { MetadataCandidate } from '@/types/metadata';

export const NO_CANDIDATE_LABEL = 'Выберите вариант...';

export function selectedCandidateLabel(candidates: MetadataCandidate[], index: number | null): string {
  if (index === null) return NO_CANDIDATE_LABEL;
  const c = candidates[index];
  return c ? `${c.artist} — ${c.title}` : NO_CANDIDATE_LABEL;
}

export function candidateAlbumLabel(c: MetadataCandidate): string {
  const albumName = (c.album || '').trim();
  return albumName ? `Альбом: ${albumName}` : 'Альбом: —';
}

export function candidateSourceLabel(c: MetadataCandidate): string {
  const provider = (c.provider || '').trim() || 'unknown';
  const percent = Math.round((c.similarity ?? 0) * 100);
  return `Источник: ${provider} — ${percent}%`;
}
