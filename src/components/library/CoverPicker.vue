<!-- src/components/library/CoverPicker.vue -->

<script setup lang="ts">
import { ref, watch } from 'vue';
import Icon from '@/components/ui/Icon.vue';

const props = defineProps<{
  modelValue: string | undefined;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | undefined): void;
}>();

const previewUrl = ref(props.modelValue);
const fileInputRef = ref<HTMLInputElement | null>(null);
const error = ref('');

watch(
  () => props.modelValue,
  (val) => {
    previewUrl.value = val;
  },
);

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    error.value = 'Выберите изображение';
    return;
  }

  error.value = '';
  const url = URL.createObjectURL(file);
  previewUrl.value = url;
  emit('update:modelValue', url);
  input.value = '';
}

function clearCover() {
  if (previewUrl.value?.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl.value);
  }
  previewUrl.value = undefined;
  emit('update:modelValue', undefined);
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2">
    <div class="group relative aspect-square w-32 overflow-hidden rounded-card bg-card-bg">
      <img v-if="previewUrl" :src="previewUrl" alt="Обложка" class="h-full w-full object-cover" />
      <div v-else class="flex h-full w-full items-center justify-center text-fg-subtle">
        <Icon name="playlist" w="w-8" h="h-8" />
      </div>

      <div
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/80 opacity-0 transition group-hover:opacity-100"
      >
        <button
          type="button"
          class="rounded-btn bg-accent px-3 py-1 text-xs font-medium text-bg hover:bg-accent-hover"
          @click="fileInputRef?.click()"
        >
          Загрузить
        </button>
        <button
          v-if="previewUrl"
          type="button"
          class="rounded-btn bg-hover-bg px-3 py-1 text-xs text-fg hover:bg-active-bg hover:text-red-400"
          @click="clearCover"
        >
          Удалить
        </button>
      </div>
    </div>
    <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="onFileChange" />
    <p v-if="error" class="text-xs text-red-400">{{ error }}</p>
  </div>
</template>
