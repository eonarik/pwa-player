<!-- src/plugins/yandexSelf/logii/LogiiGallery.vue -->

<script setup lang="ts">
import { ref, computed } from 'vue';
import Icon from '@/components/ui/Icon.vue';
import IconButton from '@/components/ui/IconButton.vue';
import type { FolderFile } from '@/types/folder';

const props = defineProps<{
  images: FolderFile[];
}>();

const fullscreenIndex = ref<number | null>(null);

const isFullscreen = computed(() => fullscreenIndex.value !== null);

function openImage(index: number): void {
  fullscreenIndex.value = index;
}

function closeFullscreen(): void {
  fullscreenIndex.value = null;
}

function next(): void {
  if (fullscreenIndex.value === null) return;
  fullscreenIndex.value = (fullscreenIndex.value + 1) % props.images.length;
}

function prev(): void {
  if (fullscreenIndex.value === null) return;
  fullscreenIndex.value = (fullscreenIndex.value - 1 + props.images.length) % props.images.length;
}

function currentUrl(): string | null {
  if (fullscreenIndex.value === null) return null;
  return props.images[fullscreenIndex.value]?.url ?? null;
}

function onKeydown(e: KeyboardEvent): void {
  if (!isFullscreen.value) return;
  if (e.key === 'Escape') closeFullscreen();
  else if (e.key === 'ArrowRight') next();
  else if (e.key === 'ArrowLeft') prev();
}

window.addEventListener('keydown', onKeydown);
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="images.length === 0" class="py-8 text-center text-xs text-fg-muted">Картинок нет.</div>

    <div v-else class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      <button
        v-for="(img, index) in images"
        :key="img.urlPath"
        type="button"
        class="group relative aspect-square overflow-hidden rounded-card bg-card-bg transition hover:opacity-90"
        @click="openImage(index)"
      >
        <img
          v-if="img.url"
          :src="img.url"
          :alt="img.name"
          class="h-full w-full object-cover transition group-hover:scale-105"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
        <Icon v-else name="image" w="w-8" h="h-8" class="absolute inset-0 m-auto text-fg-subtle" />
      </button>
    </div>

    <!-- Fullscreen -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isFullscreen"
          class="fixed inset-0 z-[200] flex items-center justify-center bg-black/90"
          @click.self="closeFullscreen"
        >
          <IconButton
            icon="arrow-left"
            variant="ghost"
            size="lg"
            label="Назад"
            class="absolute left-4 top-4 !text-white"
            @click="closeFullscreen"
          />

          <button
            v-if="images.length > 1"
            type="button"
            class="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            aria-label="Предыдущая"
            @click="prev"
          >
            <Icon name="chevron-left" w="w-6" h="w-6" />
          </button>

          <img
            v-if="currentUrl()"
            :src="currentUrl()!"
            :alt="images[fullscreenIndex!]?.name ?? ''"
            class="max-h-[90vh] max-w-[90vw] object-contain"
            @click.stop
          />

          <button
            v-if="images.length > 1"
            type="button"
            class="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            aria-label="Следующая"
            @click="next"
          >
            <Icon name="chevron-right" w="w-6" h="w-6" />
          </button>

          <p class="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60">
            {{ (fullscreenIndex ?? 0) + 1 }} / {{ images.length }}
          </p>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
