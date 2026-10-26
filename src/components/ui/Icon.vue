<!-- src/components/ui/Icon.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { ICONS, type IconName } from '@/components/icons'

const props = withDefaults(
  defineProps<{
    name: IconName
    w?: string
    h?: string
  }>(),
  {
    w: 'w-4',
    h: 'h-4',
  },
)

const iconComponent = computed(() => ICONS[props.name])
</script>

<template>
  <component :is="iconComponent" :class="[w, h]" class="icon shrink-0 text-inherit" aria-hidden="true" />
</template>
