<!-- src/components/ui/IconButton.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { type IconName } from '@/components/icons';
import { useButtonAs } from '@/composables/useButtonAs';
import Icon from './Icon.vue';

const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'ghost' | 'danger' | 'active';
    disabled?: boolean;
    label?: string;
    tooltip?: string;
    as?: 'button' | 'a';
    href?: string;
    to?: string | object;
    icon?: IconName;
    iconClass?: string;
    iconW?: string;
    iconH?: string;
  }>(),
  {
    size: 'md',
    variant: 'default',
    disabled: false,
    as: 'button',
  },
);

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();

const { tag, tagProps, onClick } = useButtonAs(props);

const sizeClasses = computed(() => {
  if (props.size === 'sm') return 'h-7 w-7 p-1';
  if (props.size === 'lg') return 'h-10 w-10 p-2';
  return 'h-8 w-8 p-1.5';
});

const variantClasses = computed(() => {
  if (props.disabled) return 'text-fg-disabled cursor-not-allowed opacity-50';
  if (props.variant === 'danger') return 'text-fg-subtle hover:bg-hover-bg hover:text-red-400';
  if (props.variant === 'active') return 'text-active bg-active/10 hover:bg-active/20';
  if (props.variant === 'ghost') return 'text-fg-muted hover:bg-hover-bg hover:text-fg';
  return 'bg-card-bg text-fg hover:bg-hover-bg';
});

const defaultIconSize = computed(() => {
  if (props.size === 'sm') return { w: 'w-3.5', h: 'h-3.5' };
  if (props.size === 'lg') return { w: 'w-5', h: 'h-5' };
  return { w: 'w-4', h: 'h-4' };
});

const effectiveIconW = computed(() => props.iconW ?? defaultIconSize.value.w);
const effectiveIconH = computed(() => props.iconH ?? defaultIconSize.value.h);

function handleClick(e: MouseEvent) {
  onClick(e);
  emit('click', e);
}
</script>

<template>
  <component
    :is="tag"
    v-bind="tagProps"
    :aria-label="label"
    :class="[sizeClasses, variantClasses]"
    class="flex shrink-0 items-center justify-center rounded-btn transition"
    v-tooltip="tooltip || label"
    @click="handleClick"
  >
    <Icon v-if="icon" :name="icon" :w="effectiveIconW" :h="effectiveIconH" :class="iconClass" />
    <slot v-else />
  </component>
</template>
