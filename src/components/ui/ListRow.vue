<!-- src/components/ui/ListRow.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    active?: boolean
    disliked?: boolean
  }>(),
  { active: false, disliked: false },
)

const emit = defineEmits<{
  (e: 'click'): void
}>()
</script>

<template>
  <div class="group relative flex items-center gap-3 border-l-2 border-transparent px-3 py-2 transition" :class="[
    active ? 'bg-active/10 text-active' : 'text-fg hover:bg-hover-bg',
    disliked ? 'border-l-red-500/40' : '',
  ]">
    <div role="button" tabindex="0" class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
      @click="emit('click')" @keydown.enter="emit('click')" @keydown.space.prevent="emit('click')">
      <slot name="leading" />

      <div class="min-w-0 flex-1">
        <slot name="title" />
        <slot name="subtitle" />
      </div>

      <slot name="meta" />
    </div>

    <div class="flex shrink-0 items-center gap-1">
      <slot name="trailing" />
    </div>
  </div>
</template>
