<!-- src/components/ui/DropdownMenu.vue -->

<script setup lang="ts">
import { useMenu } from '@/composables/useMenu';

const props = withDefaults(
  defineProps<{
    /** Ширина dropdown в px */
    width?: number;
    /** true — растянуть на всю ширину триггера (для модалок с широкими строками) */
    fullWidth?: boolean;
    /** Выравнивание: right — по правому краю кнопки, left — по левому */
    align?: 'right' | 'left';
  }>(),
  { width: 256, fullWidth: false, align: 'right' },
);

const { isOpen, setTriggerRef, position, toggle, close } = useMenu({
  width: props.width,
  fullWidth: props.fullWidth,
  align: props.align,
});

defineExpose({ close });
</script>

<template>
  <slot name="trigger" :is-open="isOpen" :toggle="toggle" :set-trigger-ref="setTriggerRef" />

  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed z-[200] overflow-hidden bg-bg-elevated shadow-lg radio-shadow-elevated"
      :style="{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: position.width !== null ? `${position.width}px` : `${width}px`,
      }"
      @click.stop
    >
      <slot :close="close" />
    </div>
  </Teleport>
</template>

