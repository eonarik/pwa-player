<!-- src/components/ui/DropdownMenu.vue -->
<script setup lang="ts">
import { useMenu } from '@/composables/useMenu'

const props = withDefaults(
  defineProps<{
    /** Ширина dropdown в px */
    width?: number
    /** Выравнивание: right — по правому краю кнопки, left — по левому */
    align?: 'right' | 'left'
  }>(),
  { width: 256, align: 'right' },
)

const { isOpen, setTriggerRef, position, toggle, close } = useMenu({
  width: props.width,
  align: props.align,
})

defineExpose({ close })
</script>

<template>
  <slot name="trigger" :is-open="isOpen" :toggle="toggle" :set-trigger-ref="setTriggerRef" />

  <Teleport to="body">
    <div v-if="isOpen" class="fixed z-[100] overflow-hidden bg-bg-elevated shadow-lg" :style="{
      top: `${position.top}px`,
      left: `${position.left}px`,
      width: `${width}px`,
    }" @click.stop>
      <slot :close="close" />
    </div>
  </Teleport>
</template>
