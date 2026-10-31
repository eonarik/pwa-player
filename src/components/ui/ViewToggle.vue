<!-- src/components/ui/ViewToggle.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import type { IconName } from '@/components/icons';

const props = defineProps<{
  modelValue: 'grid' | 'list';
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: 'grid' | 'list'): void;
}>();

const isGrid = computed(() => props.modelValue === 'grid');
const iconName = computed<IconName>(() => (isGrid.value ? 'list-play' : 'grid'));
const label = computed(() => (isGrid.value ? 'Вид списком' : 'Вид плиткой'));

function toggle() {
  emit('update:modelValue', isGrid.value ? 'list' : 'grid');
}
</script>

<template>
  <button
    type="button"
    class="flex h-8 w-8 items-center justify-center rounded-btn bg-card-bg text-fg-muted transition hover:bg-hover-bg hover:text-fg"
    @click="toggle"
    :aria-label="label"
    v-tooltip="label"
  >
    <Icon :name="iconName" w="w-4" h="h-4" />
  </button>
</template>
