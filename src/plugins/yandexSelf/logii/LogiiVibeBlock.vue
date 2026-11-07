<!-- src/plugins/yandexSelf/logii/LogiiVibeBlock.vue -->

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import Icon from '@/components/ui/Icon.vue';
import Spinner from '@/components/ui/Spinner.vue';
import Textarea from "@/components/ui/Textarea.vue";

const props = defineProps<{
  vibe: string;
  title: string;
  isLoading: boolean;
  isSaving: boolean;
  onUpdateVibe: (text: string) => Promise<boolean>;
}>();

const isEditingVibe = ref(false);
const vibeDraft = ref('');
const vibeTextareaRef = ref<HTMLTextAreaElement | null>(null);

const VIBE_MIN_ROWS = 1;
const VIBE_MAX_ROWS = 10;

const currentVibe = computed(() => props.vibe);

function autosizeVibe(): void {
  const el = vibeTextareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  const style = window.getComputedStyle(el);
  const lineHeight = parseFloat(style.lineHeight) || 20;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const borderBottom = parseFloat(style.borderBottomWidth) || 0;
  const rows = Math.max(VIBE_MIN_ROWS, Math.min(VIBE_MAX_ROWS, Math.ceil(el.scrollHeight / lineHeight)));
  const height = rows * lineHeight + paddingTop + paddingBottom + borderTop + borderBottom;
  el.style.height = `${height}px`;
  el.style.overflowY = rows >= VIBE_MAX_ROWS ? 'auto' : 'hidden';
}

function startEdit(): void {
  vibeDraft.value = currentVibe.value;
  isEditingVibe.value = true;
  nextTick(() => autosizeVibe());
}

function cancelEdit(): void {
  isEditingVibe.value = false;
  vibeDraft.value = '';
}

async function saveVibe(): Promise<void> {
  const ok = await props.onUpdateVibe(vibeDraft.value);
  if (ok) isEditingVibe.value = false;
}

watch(
  () => isEditingVibe.value,
  (editing) => {
    if (editing) nextTick(() => autosizeVibe());
  },
);
</script>

<template>
  <div class="rounded-card bg-card-bg p-4">
    <div class="mb-2 flex items-center justify-between">
      <p class="text-sm font-medium text-fg">{{ title }}</p>
      <button
        v-if="!isEditingVibe && !isLoading"
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
        ref="vibeTextareaRef"
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
