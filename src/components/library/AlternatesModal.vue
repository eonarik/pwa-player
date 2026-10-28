<!-- src/components/library/AlternatesModal.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useLibraryStore } from '@/stores/library'
import ModalLayout from '@/components/ui/ModalLayout.vue'
import Button from '@/components/ui/Button.vue'
import type { LibraryTrack } from '@/types/library'

const props = defineProps<{
  trackIds: string[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const library = useLibraryStore()

const tracksWithAlternates = computed(() => {
  return props.trackIds
    .map((id) => library.getTrack(id))
    .filter((t): t is LibraryTrack => Boolean(t) && Boolean(t?.alternateSources?.length))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
})

function getAlbumName(track: LibraryTrack): string {
  if (!track.albumId) return 'Без альбома'
  const album = library.getAlbum(track.albumId)
  return album?.name ?? 'Без альбома'
}

function onConfirm(trackId: string, altId: string) {
  library.confirmAlternate(trackId, altId)
}

function onDismiss(trackId: string, altId: string) {
  library.dismissAlternate(trackId, altId)
}
</script>

<template>
  <ModalLayout title="Проблемные совпадения" max-width="lg" @close="emit('close')">
    <div v-if="tracksWithAlternates.length === 0" class="py-8 text-center text-sm text-fg-muted">
      Нет треков с альтернативными источниками
    </div>

    <div v-else class="flex flex-col gap-6">
      <p class="text-xs text-fg-muted">
        Для следующих треков найдены похожие совпадения. Подтвердите, если это один и тот же трек.
      </p>

      <div v-for="track in tracksWithAlternates" :key="track.id"
        class="flex flex-col gap-3 border-b border-hover-bg pb-4 last:border-b-0 last:pb-0">

        <div class="flex items-center gap-3">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-fg">
              {{ track.artist }} — {{ track.title }}
            </p>
            <p class="truncate text-xs text-fg-muted">
              {{ getAlbumName(track) }}
            </p>
          </div>
          <span class="shrink-0 rounded bg-active/20 px-1.5 py-0.5 text-[10px] font-bold text-active">
            Основной
          </span>
        </div>

        <div class="flex flex-col gap-2 pl-4">
          <div v-for="alt in track.alternateSources" :key="alt.id"
            class="flex items-center gap-3 rounded-btn bg-card-bg p-2">
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs text-fg">
                <span class="text-fg-muted">Источник:</span> {{ alt.pluginId }}
              </p>
              <p v-if="alt.url" class="truncate text-[10px] text-fg-subtle">
                {{ alt.url }}
              </p>
            </div>

            <div class="flex shrink-0 items-center gap-1">
              <button type="button"
                class="rounded-btn px-2 py-1 text-[10px] font-medium text-active transition hover:bg-active/10"
                @click="onConfirm(track.id, alt.id)">
                Это он
              </button>
              <button type="button"
                class="rounded-btn px-2 py-1 text-[10px] text-fg-muted transition hover:bg-red-500/10 hover:text-red-400"
                @click="onDismiss(track.id, alt.id)">
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
