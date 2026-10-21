<!-- src/components/ui/SectionTitle.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    text?: string
    /** Дополнительный отступ слева/справа. По умолчанию px-4. */
    paddingX?: 'none' | 'px-1' | 'px-3' | 'px-4' | 'px-5'
    /** Отступ сверху. По умолчанию нет. */
    paddingTop?: 'none' | 'pt-1' | 'pt-2' | 'pt-4'
    /** Отступ снизу. По умолчанию pb-2. */
    paddingBottom?: 'none' | 'pb-1' | 'pb-2' | 'pb-3'
    /** Если true — рендерится как button, эмитит click. */
    clickable?: boolean
  }>(),
  {
    paddingX: 'px-4',
    paddingTop: 'none',
    paddingBottom: 'pb-2',
    clickable: false,
  },
)

const emit = defineEmits<{
  (e: 'click'): void
}>()

const PADDING_X: Record<string, string> = {
  none: '',
  'px-1': 'px-1',
  'px-3': 'px-3',
  'px-4': 'px-4',
  'px-5': 'px-5',
}
const PADDING_TOP: Record<string, string> = {
  none: '',
  'pt-1': 'pt-1',
  'pt-2': 'pt-2',
  'pt-4': 'pt-4',
}
const PADDING_BOTTOM: Record<string, string> = {
  none: '',
  'pb-1': 'pb-1',
  'pb-2': 'pb-2',
  'pb-3': 'pb-3',
}
</script>

<template>
  <div class="flex items-center justify-between gap-2"
    :class="[PADDING_X[paddingX], PADDING_TOP[paddingTop], PADDING_BOTTOM[paddingBottom]]">
    <component :is="clickable ? 'button' : 'p'" :type="clickable ? 'button' : undefined"
      class="text-[10px] font-medium uppercase tracking-wider text-fg-subtle"
      :class="clickable ? 'cursor-pointer select-none transition hover:text-fg-muted' : ''"
      @click="clickable ? emit('click') : undefined">
      <slot>{{ text }}</slot>
    </component>
    <slot name="trailing" />
  </div>
</template>
