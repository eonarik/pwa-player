<!-- src/components/ui/ListRow.vue -->

<script setup lang="ts">
withDefaults(
  defineProps<{
    active?: boolean;
    disliked?: boolean;
    downloadProgress?: number | null;
    downloaded?: boolean;
  }>(),
  { active: false, disliked: false, downloadProgress: null, downloaded: false },
);

const emit = defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <div
    class="list-row group relative flex items-center gap-3 border-l-2 border-transparent px-2 py-2 transition radio-inset content-visibility-auto"
    :class="[
      active ? 'list-row_active bg-active/10 text-active' : 'text-fg hover:bg-hover-bg',
      disliked && 'list-row_disliked',
      downloaded && 'list-row_downloaded',
    ]"
    :style="{ '--download-progress': downloadProgress !== null ? `${downloadProgress * 100}%` : '0%' }"
  >
    <!-- индикатор dislike -->
    <div
      v-if="disliked"
      class="list-row-indicator-dislike pointer-events-none absolute bottom-0 left-1 top-0 w-0.5 bg-red-400"
      aria-hidden="true"
    />

    <!-- прогресс/индикатор скачивания -->
    <div
      v-if="downloaded || downloadProgress !== null"
      class="list-row-indicator-download pointer-events-none absolute bottom-0 left-0 w-0.5 bg-emerald-500"
      :style="{
        height: downloaded ? '100%' : `${(downloadProgress ?? 0) * 100}%`,
        bottom: 0,
        top: 'auto',
      }"
      aria-hidden="true"
    />

    <!-- Кликабельная зона -->
    <div
      role="button"
      tabindex="0"
      class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
      @click="emit('click')"
      @keydown.enter="emit('click')"
      @keydown.space.prevent="emit('click')"
      data-testid="list-row-click-zone"
    >
      <slot name="leading" />

      <div class="min-w-0 flex-1">
        <slot name="title" />
        <slot name="subtitle" />
      </div>

      <slot name="meta" />
    </div>

    <!-- Trailing: actions -->
    <div class="flex shrink-0 items-center gap-1">
      <slot name="trailing" />
    </div>
  </div>
</template>

<style scoped>
.content-visibility-auto {
  content-visibility: auto;
  /* Указываем примерную высоту, чтобы браузер не прыгал при скролле */
  contain-intrinsic-size: 0 56px;
}
</style>
