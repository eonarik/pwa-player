// src/components/library/metadata/useMetadataCandidates.ts

import { ref, type Ref } from 'vue';
import { metadataService } from '@/services/metadata/MetadataService';
import type { MetadataCandidate } from '@/types/metadata';
import type { Track } from '@/types/track';
import { logger } from '@/utils/logger';

export interface MetadataCandidates {
  candidates: Ref<MetadataCandidate[]>;
  isLoading: Ref<boolean>;
  selectedIndex: Ref<number | null>;
  load: () => Promise<void>;
  select: (index: number) => MetadataCandidate | null;
}

/** Список вариантов из интернета + выбор одного из них. */
export function useMetadataCandidates(track: Ref<Track>): MetadataCandidates {
  const candidates = ref<MetadataCandidate[]>([]);
  const isLoading = ref(false);
  const selectedIndex = ref<number | null>(null);

  async function load(): Promise<void> {
    if (!track.value.title?.trim()) return;
    isLoading.value = true;
    try {
      candidates.value = await metadataService.fetchCandidates(track.value.id);
    } catch (err) {
      logger.warn('[metadata-modal] failed to load candidates', err);
    } finally {
      isLoading.value = false;
    }
  }

  function select(index: number): MetadataCandidate | null {
    const candidate = candidates.value[index];
    if (!candidate) return null;
    selectedIndex.value = index;
    return candidate;
  }

  return { candidates, isLoading, selectedIndex, load, select };
}
