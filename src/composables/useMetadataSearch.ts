// src/composables/useMetadataSearch.ts

import { computed, ref, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { trackMetadataService } from '@/services/metadata/TrackMetadataService';
import { metadataService } from '@/services/metadata/MetadataService';
import { useUiSettingsStore } from '@/stores/uiSettings';
import type { Track } from '@/types/track';
import { useLibraryStore } from '@/stores/library';

const CONCURRENCY = 3;
const FLUSH_INTERVAL = 10;

export interface MetadataIssue {
  track: Track;
}

export function useMetadataSearch(tracks: Ref<Track[]>) {
  const uiSettings = useUiSettingsStore();
  const { metadataThreshold } = storeToRefs(uiSettings);

  const isLoading = ref(false);
  const progress = ref({ done: 0, total: 0 });
  const abortController = ref<AbortController | null>(null);

  const version = ref(0);

  function bumpVersion(): void {
    version.value++;
  }

  const tracksNeedingMetadata = computed(() =>
    tracks.value.filter((t) => {
      if (t.hasId3Tags) return false;

      const library = useLibraryStore();
      const album = t.albumId ? library.getAlbum(t.albumId) : null;

      const hasArtist = t.artist.trim().length > 0;
      const hasAlbum = (album?.name?.trim().length ?? 0) > 0;
      const hasCover = Boolean(album?.coverUrl || t.coverUrl);

      return !hasArtist || !hasAlbum || !hasCover;
    }),
  );

  const uncheckedTracks = computed(() => {
    return tracksNeedingMetadata.value.filter((t) => {
      const entry = metadataService.getEntry(t.id);
      if (entry && entry.artist === null) return false;
      return true;
    });
  });

  const stats = computed(() => {
    let found = 0;
    let checked = 0;
    const library = useLibraryStore();

    for (const t of tracks.value) {
      if (t.hasId3Tags) checked++;

      const album = t.albumId ? library.getAlbum(t.albumId) : null;
      const hasArtist = t.artist.trim().length > 0;
      const hasAlbum = (album?.name?.trim().length ?? 0) > 0;
      const hasCover = Boolean(album?.coverUrl || t.coverUrl);

      if (hasArtist && hasAlbum && hasCover) found++;
    }

    return { found, checked, total: tracks.value.length };
  });

  const hasUnchecked = computed(() => uncheckedTracks.value.length > 0);
  const issues = ref<MetadataIssue[]>([]);

  async function search(): Promise<void> {
    if (isLoading.value) return;
    const toFetch = uncheckedTracks.value;
    if (toFetch.length === 0) return;

    isLoading.value = true;
    progress.value = { done: 0, total: toFetch.length };
    abortController.value = new AbortController();
    const signal = abortController.value.signal;

    const threshold = metadataThreshold.value;

    const foundIssues: MetadataIssue[] = [];
    let sinceLastFlush = 0;
    let cursor = 0;

    try {
      const worker = async (): Promise<void> => {
        while (cursor < toFetch.length) {
          if (signal.aborted) return;
          const track = toFetch[cursor++]!;

          const result = await trackMetadataService.fetch(track.artist ?? '', track.title, threshold, signal);

          if (signal.aborted) return;
          if (result.status === 'aborted') return;

          if (result.status === 'error') {
            progress.value = { done: progress.value.done + 1, total: toFetch.length };
            continue;
          }

          if (result.status === 'not-found') {
            metadataService.markNotFound(track.id);
            progress.value = { done: progress.value.done + 1, total: toFetch.length };
            bumpVersion();
            continue;
          }

          const applyResult = metadataService.applyRemote(track.id, result.data);

          if (applyResult.status === 'candidates') {
            const library = useLibraryStore();
            const updated = library.getTrack(track.id);
            if (updated) foundIssues.push({ track: updated });
          }

          progress.value = { done: progress.value.done + 1, total: toFetch.length };
          bumpVersion();

          sinceLastFlush++;
          if (sinceLastFlush >= FLUSH_INTERVAL) {
            sinceLastFlush = 0;
            await metadataService.flush();
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, toFetch.length) }, () => worker()));

      await metadataService.flush();
      issues.value = foundIssues;
      bumpVersion();
    } finally {
      isLoading.value = false;
      progress.value = { done: 0, total: 0 };
      abortController.value = null;
    }
  }

  function cancel(): void {
    abortController.value?.abort();
  }

  async function reset(): Promise<void> {
    const ids = tracks.value.map((t) => t.id);
    if (ids.length === 0) return;
    await metadataService.resetMany(ids);
    issues.value = [];
    bumpVersion();
  }

  function dismissIssues(): void {
    issues.value = [];
  }

  return {
    isLoading,
    progress,
    tracksNeedingMetadata,
    uncheckedTracks,
    stats,
    hasUnchecked,
    issues,
    search,
    cancel,
    reset,
    dismissIssues,
  };
}
