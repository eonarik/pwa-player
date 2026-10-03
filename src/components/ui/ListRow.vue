<!-- src/components/ui/ListRow.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    active?: boolean
    disliked?: boolean
    /** 0..1 — если задано, показывается синий прогресс снизу вверх */
    downloadProgress?: number | null
    /** Полностью скачан — синяя полоска на всю высоту */
    downloaded?: boolean
  }>(),
  { active: false, disliked: false, downloadProgress: null, downloaded: false },
)

const emit = defineEmits<{
  (e: 'click'): void
}>()
</script>

<template>
  <div
    class="group relative flex items-center gap-3 border-l-2 border-transparent px-2 py-2 transition"
    :class="[active ? 'bg-active/10 text-active' : 'text-fg hover:bg-hover-bg']"
  >
    <!-- индикатор dislike -->
    <div
      v-if="disliked"
      class="pointer-events-none absolute bottom-0 left-0.5 top-0 w-0.5 bg-red-400"
      aria-hidden="true"
    />

    <!-- прогресс/индикатор скачивания — под красной полоской, растёт снизу вверх -->
    <div
      v-if="downloaded || downloadProgress !== null"
      class="pointer-events-none absolute bottom-0 left-0 top-0 w-0.5 bg-emerald-500"
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
