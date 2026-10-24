<!-- src/components/ui/Button.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useButtonAs } from '@/composables/useButtonAs'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    href?: string
    to?: string | object
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    type: 'button',
  },
)

const { tag, tagProps, onClick } = useButtonAs(props)

const sizeClasses = computed(() => {
  if (props.size === 'sm') return 'px-3 py-1.5 text-xs'
  if (props.size === 'lg') return 'px-6 py-3 text-base'
  return 'px-4 py-2 text-sm'
})

const variantClasses = computed(() => {
  if (props.variant === 'primary') return 'bg-accent text-bg hover:bg-accent-hover'
  if (props.variant === 'danger') return 'bg-red-500/10 text-red-400 hover:bg-red-500/15'
  if (props.variant === 'ghost') return 'text-fg-muted hover:bg-hover-bg hover:text-fg'
  return 'bg-card-bg text-fg hover:bg-hover-bg'
})
</script>

<template>
  <component :is="tag" v-bind="tagProps"
    class="inline-flex items-center justify-center gap-2 rounded-btn font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
    :class="[sizeClasses, variantClasses]" @click="onClick">
    <slot />
  </component>
</template>
