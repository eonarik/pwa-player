<!-- src/components/library/MetadataCandidatesModal.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { metadataService } from '@/services/metadata/MetadataService';
import ModalLayout from '@/components/ui/ModalLayout.vue';
import Button from '@/components/ui/Button.vue';
import CoverImage from '@/components/ui/CoverImage.vue';
import type { Track } from '@/types/track';
import type { TrackId } from '@/types/ids';

const props = defineProps<{
  trackIds: TrackId[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const library = useLibraryStore();

const tracksWithCandidates = computed(() => {
  return props.trackIds
    .map((id) => library.getTrack(id))
    .filter((t): t is Track => Boolean(t) && Boolean(t?.metadataCandidates?.length))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
});

function getAlbumName(track: Track): string {
  if (!track.albumId) return 'Без альбома';
  const album = library.getAlbum(track.albumId);
  return album?.name ?? 'Без альбома';
}

function onApply(trackId: TrackId, candidateId: string) {
  const track = library.getTrack(trackId);
  if (!track) return;
  const candidate = track.metadataCandidates.find((c) => c.id === candidateId);
  if (!candidate) return;

  metadataService.updateManual(trackId, {
    artist: candidate.artist,
    title: candidate.title,
    album: candidate.album,
    coverUrl: candidate.coverUrl ?? undefined,
  });
}

function onDismiss(trackId: TrackId, candidateId: string) {
  const track = library.getTrack(trackId);
  if (!track) return;
  const next = track.metadataCandidates.filter((c) => c.id !== candidateId);
  createLibraryWriter().updateTrackMetadataCandidates(trackId, next);
}
</script>

<template>
  <ModalLayout title="Проблемные совпадения" max-width="lg" @close="emit('close')">
    <div v-if="tracksWithCandidates.length === 0" class="py-8 text-center text-sm text-fg-muted">
      Нет треков с альтернативными метаданными
    </div>

    <div v-else class="flex flex-col gap-6">
      <p class="text-xs text-fg-muted">
        Для следующих треков найдены похожие метаданные. Примените, если это тот же трек.
      </p>

      <div
        v-for="track in tracksWithCandidates"
        :key="track.id"
        class="flex flex-col gap-3 border-b border-hover-bg pb-4 last:border-b-0 last:pb-0"
      >
        <!-- Заголовок: Текущий трек -->
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 shrink-0 overflow-hidden rounded-btn bg-card-bg">
            <CoverImage
              :src="track.albumId ? library.getAlbum(track.albumId)?.coverUrl : track.coverUrl"
              :alt="track.title"
              fallback-icon-class="h-5 w-5"
            />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-fg">{{ track.artist }} — {{ track.title }}</p>
            <p class="truncate text-xs text-fg-muted">{{ getAlbumName(track) }}</p>
          </div>
          <span class="shrink-0 rounded bg-active/20 px-1.5 py-0.5 text-[10px] font-bold text-active">Основной</span>
        </div>

        <!-- Список кандидатов -->
        <div class="flex flex-col gap-2 pl-4">
          <div
            v-for="candidate in track.metadataCandidates"
            :key="candidate.id"
            class="flex items-center gap-3 rounded-btn bg-card-bg p-2 transition hover:bg-hover-bg"
          >
            <!-- Обложка кандидата -->
            <div class="h-12 w-12 shrink-0 overflow-hidden rounded-btn bg-bg">
              <CoverImage :src="candidate.coverUrl" :alt="candidate.title" fallback-icon-class="h-5 w-5" />
            </div>

            <!-- Текст кандидата -->
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-fg">
                <span v-if="candidate.artist">{{ candidate.artist }} — </span>{{ candidate.title }}
              </p>
              <p class="truncate text-xs text-fg-muted">
                {{ candidate.album || 'Без альбома' }}
                <span class="text-fg-subtle mx-1">·</span>
                {{ candidate.provider }}
                <span class="text-fg-subtle mx-1">·</span>
                {{ Math.round(candidate.similarity * 100) }}%
              </p>
            </div>

            <!-- Кнопки действий -->
            <div class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="rounded-btn px-2 py-1 text-[10px] font-medium text-active transition hover:bg-active/10"
                @click="onApply(track.id, candidate.id)"
              >
                Это он
              </button>
              <button
                type="button"
                class="rounded-btn px-2 py-1 text-[10px] text-fg-muted transition hover:bg-red-500/10 hover:text-red-400"
                @click="onDismiss(track.id, candidate.id)"
              >
                Не он
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end">
        <Button variant="ghost" @click="emit('close')">Закрыть</Button>
      </div>
    </template>
  </ModalLayout>
</template>
