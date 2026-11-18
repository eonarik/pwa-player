<!-- src/plugins/yandexSelf/logii/LogiiVibeBlock.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from '@/components/atoms/Icon.vue';
import Spinner from '@/components/atoms/Spinner.vue';
import Textarea from '@/components/atoms/Textarea.vue';

const props = defineProps<{
  vibe: string;
  title: string;
  isLoading: boolean;
  isSaving: boolean;
  isEditMode: boolean;
  onUpdateVibe: (text: string) => Promise<boolean>;
}>();

const isEditingVibe = ref(false);
const vibeDraft = ref('');

const currentVibe = computed(() => props.vibe);

function startEdit(): void {
  vibeDraft.value = currentVibe.value;
  isEditingVibe.value = true;
}

function cancelEdit(): void {
  isEditingVibe.value = false;
  vibeDraft.value = '';
}

async function saveVibe(): Promise<void> {
  const ok = await props.onUpdateVibe(vibeDraft.value);
  if (ok) isEditingVibe.value = false;
}


</script>

<template>
  <div class="rounded-card bg-card-bg p-4">
    <div class="mb-2 flex items-center justify-between">
      <p class="text-sm font-medium text-fg">{{ title }}</p>
      <button
        v-if="!isEditingVibe && !isLoading && isEditMode"
        type="button"
        class="rounded-btn bg-card-bg px-2 py-1 text-xs text-fg-muted transition hover:bg-hover-bg hover:text-fg"
        data-testid="logii-vibe-edit"
        @click="startEdit"
      >
        <Icon name="pencil" w="w-3.5" h="h-3.5" class="mr-1 inline" />
        {{ currentVibe ? 'Редактировать' : 'Написать' }}
      </button>
    </div>

    <div v-if="isLoading" class="flex items-center gap-2 text-xs text-fg-muted">
      <Spinner size="sm" />
      Загружаем Vibe…
    </div>

    <template v-else-if="isEditingVibe">
      <Textarea
        v-model="vibeDraft"
        :rows="1"
        :min-rows="1"
        :max-rows="10"
        auto-resize
        placeholder="Опиши вайб…"
        data-testid="logii-vibe-textarea"
      />
      <div class="mt-2 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-btn px-3 py-1 text-xs text-fg-muted hover:text-fg"
          data-testid="logii-vibe-cancel"
          @click="cancelEdit"
        >
          Отмена
        </button>
        <button
          type="button"
          class="rounded-btn bg-accent px-3 py-1 text-xs font-medium text-bg hover:bg-accent-hover disabled:opacity-50"
          :disabled="isSaving"
          data-testid="logii-vibe-save"
          @click="saveVibe"
        >
          {{ isSaving ? 'Сохраняем…' : 'Сохранить' }}
        </button>
      </div>
    </template>

    <p v-else-if="currentVibe" class="whitespace-pre-line text-sm text-fg">{{ currentVibe }}</p>
    <p v-else class="text-xs text-fg-muted">Vibe пока нет. Напиши первый комментарий — файл создастся автоматически.</p>
  </div>
</template>
