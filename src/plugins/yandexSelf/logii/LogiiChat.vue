<!-- src/plugins/yandexSelf/logii/LogiiChat.vue -->

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue';
import type { LogiiComment } from './parseLogii';
import { getNickname, setNickname } from './useLogiiData';
import IconButton from '@/components/atoms/IconButton.vue';
import Spinner from '@/components/atoms/Spinner.vue';
import Textarea from '@/components/atoms/Textarea.vue';import Divider from '@/components/atoms/Divider.vue';

const props = withDefaults(
  defineProps<{
    comments: LogiiComment[];
    isSaving: boolean;
    isLoading?: boolean;
    isEditMode?: boolean;
    trackUrlPath?: string;
    onUpdateComment: (index: number, text: string) => Promise<boolean>;
    onDeleteComment: (index: number) => Promise<boolean>;
  }>(),
  { isLoading: false, isEditMode: false, trackUrlPath: '' },
);

const emit = defineEmits<{
  (e: 'send', text: string): void;
}>();

const nickname = ref(getNickname());
const draft = ref('');
const scrollRef = ref<HTMLElement | null>(null);

// Состояние редактирования: индекс комментария, который сейчас редактируется.
const editingIndex = ref<number | null>(null);
const editingText = ref('');
const editingTextareaRef = ref<HTMLTextAreaElement | null>(null);

const canSend = () => nickname.value.trim().length > 0 && draft.value.trim().length > 0 && !props.isSaving;

function send(): void {
  if (!canSend()) return;
  const trimmedNick = nickname.value.trim();
  setNickname(trimmedNick);
  emit('send', draft.value.trim());
  draft.value = '';
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    send();
  }
}

let nickSaveTimer: ReturnType<typeof setTimeout> | null = null;
watch(nickname, (value) => {
  if (nickSaveTimer !== null) clearTimeout(nickSaveTimer);
  nickSaveTimer = setTimeout(() => {
    nickSaveTimer = null;
    const trimmed = value.trim();
    if (trimmed) setNickname(trimmed);
  }, 300);
});

watch(
  () => props.trackUrlPath,
  () => {
    nickname.value = getNickname();
    // Сбрасываем редактирование при смене трека.
    editingIndex.value = null;
    editingText.value = '';
  },
);

async function scrollToBottom(): Promise<void> {
  await nextTick();
  if (scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
  }
}

watch(
  () => [props.comments.length, props.isSaving] as const,
  ([, saving]) => {
    if (!saving) void scrollToBottom();
  },
);

onMounted(() => {
  void scrollToBottom();
});

function formatCommentTime(time: string | null): string {
  return time ?? '';
}

// --- Редактирование ---

function startEdit(index: number): void {
  const comment = props.comments[index];
  if (!comment) return;
  editingIndex.value = index;
  editingText.value = comment.text;
  nextTick(() => {
    editingTextareaRef.value?.focus();
  });
}

function cancelEdit(): void {
  editingIndex.value = null;
  editingText.value = '';
}

async function saveEdit(index: number): Promise<void> {
  if (props.isSaving) return;
  const text = editingText.value.trim();
  if (!text) return;

  const ok = await props.onUpdateComment(index, text);
  if (ok) {
    editingIndex.value = null;
    editingText.value = '';
  }
}

// --- Удаление ---

async function removeComment(index: number): Promise<void> {
  if (props.isSaving) return;
  const ok = await props.onDeleteComment(index);
  if (ok && editingIndex.value === index) {
    cancelEdit();
  }
  // Если удалили комментарий, который был в режиме редактирования — сбрасываем.
  if (ok && editingIndex.value !== null && index < editingIndex.value) {
    editingIndex.value -= 1;
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Лента комментариев -->
    <div ref="scrollRef" class="flex flex-col rounded-card bg-card-bg">
      <div v-if="isLoading" class="flex items-center justify-center gap-2 py-10 text-xs text-fg-muted">
        <Spinner size="sm" />
        Загружаем чат…
      </div>

      <div v-else-if="comments.length === 0 && !isSaving" class="py-8 text-center text-xs text-fg-muted">
        Пока никто не написал. Будь первым.
      </div>

      <template v-else>
        <template v-for="(c, index) in comments" :key="index">
          <Divider v-if="index > 0" :vertical="false" :withMargin="false" />
          <div
            class="relative group flex flex-col gap-0.5 rounded-btn bg-bg-elevated/50 px-4 pt-2 pb-3"
            :data-testid="`logii-comment-${index}`"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-medium text-active">
                {{ c.nickname }}
                <span v-if="c.time" class="text-[10px] pl-2 text-fg-subtle">{{ formatCommentTime(c.time) }}</span>
              </p>
              <template v-if="editingIndex !== index">
                <div
                  v-if="isEditMode"
                  class="absolute top-1 right-1 flex items-center gap-0.5 pr-1 opacity-0 transition group-hover:opacity-100 bg-bg-elevated/80"
                >
                  <IconButton
                    :icon="'pencil'"
                    class="hover:bg-hover-bg hover:text-fg transition"
                    :disabled="isSaving"
                    aria-label="Редактировать комментарий"
                    :data-testid="`logii-comment-edit-${index}`"
                    @click="startEdit(index)"
                  />
                  <IconButton
                    class="hover:bg-hover-bg hover:text-red-400 transition"
                    :icon="'trash'"
                    :disabled="isSaving"
                    aria-label="Удалить комментарий"
                    :data-testid="`logii-comment-delete-${index}`"
                    @click="removeComment(index)"
                  />
                </div>
              </template>
            </div>

            <template v-if="editingIndex === index">
              <Textarea
                ref="editingTextareaRef"
                v-model="editingText"
                :rows="1"
                :min-rows="1"
                :max-rows="10"
                auto-resize
                :disabled="isSaving"
                data-testid="logii-comment-edit-input"
                class="mt-1"
              />
              <div class="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-btn px-2 py-0.5 text-xs text-fg-muted transition hover:text-fg disabled:opacity-50"
                  :disabled="isSaving"
                  data-testid="logii-comment-cancel"
                  @click="cancelEdit"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  class="rounded-btn bg-accent px-2 py-0.5 text-xs font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50"
                  :disabled="isSaving || !editingText.trim()"
                  data-testid="logii-comment-save"
                  @click="saveEdit(index)"
                >
                  <Spinner v-if="isSaving" size="sm" />
                  <span v-else>Сохранить</span>
                </button>
              </div>
            </template>

            <p v-else class="whitespace-pre-line text-sm text-fg">{{ c.text }}</p>
          </div>
        </template>
      </template>

      <div
        v-if="isSaving && editingIndex === null"
        class="flex items-center justify-center gap-2 rounded-btn bg-bg-elevated/50 px-3 py-2 text-xs text-fg-muted"
      >
        <Spinner size="sm" />
        Отправляем…
      </div>
    </div>

    <!-- Никнейм и ввод -->
    <div class="flex flex-col gap-1">
      <label class="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">Твой ник</label>
      <input
        v-model="nickname"
        type="text"
        placeholder="Как тебя подписать? (сохраняется для всех чатов)"
        class="rounded-btn bg-card-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none"
        :disabled="isSaving"
        data-testid="logii-nickname-input"
      />

      <div class="flex items-end gap-2 mt-2">
        <Textarea
          v-model="draft"
          :rows="1"
          :min-rows="1"
          :max-rows="8"
          auto-resize
          placeholder="Написать комментарий… (Ctrl+Enter — отправить)"
          class="flex-1"
          :disabled="isSaving || isLoading"
          data-testid="logii-comment-new-input"
          @keydown="onKeydown"
        />
        <IconButton
          :icon="isSaving ? 'spinner' : 'arrow-up'"
          :icon-class="isSaving ? 'animate-spin' : ''"
          variant="active"
          :label="isSaving ? 'Отправляем…' : 'Отправить'"
          :disabled="!canSend()"
          data-testid="logii-comment-send"
          @click="send"
        />
      </div>
      <p v-if="!nickname.trim()" class="text-[10px] text-amber-400 px-1">Введи ник, чтобы отправлять комментарии.</p>
    </div>
  </div>
</template>
