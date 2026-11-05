<!-- src/plugins/yandexSelf/logii/LogiiChat.vue -->

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue';
import type { LogiiComment } from './parseLogii';
import { getNickname, setNickname } from './useLogiiData';
import IconButton from '@/components/ui/IconButton.vue';
import Spinner from '@/components/ui/Spinner.vue';

const props = withDefaults(
  defineProps<{
    comments: LogiiComment[];
    isSaving: boolean;
    isLoading?: boolean;
    trackUrlPath?: string;
  }>(),
  { isLoading: false, trackUrlPath: '' },
);

const emit = defineEmits<{
  (e: 'send', text: string): void;
}>();

const nickname = ref(getNickname());
const draft = ref('');
const scrollRef = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const MIN_ROWS = 1;
const MAX_ROWS = 8;

const canSend = () => nickname.value.trim().length > 0 && draft.value.trim().length > 0 && !props.isSaving;

function autosize(): void {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  const style = window.getComputedStyle(el);
  const lineHeight = parseFloat(style.lineHeight) || 20;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const borderBottom = parseFloat(style.borderBottomWidth) || 0;
  const rows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, Math.ceil(el.scrollHeight / lineHeight)));
  const height = rows * lineHeight + paddingTop + paddingBottom + borderTop + borderBottom;
  el.style.height = `${height}px`;
  el.style.overflowY = rows >= MAX_ROWS ? 'auto' : 'hidden';
}

function send(): void {
  if (!canSend()) return;
  const trimmedNick = nickname.value.trim();
  setNickname(trimmedNick);
  emit('send', draft.value.trim());
  draft.value = '';
  nextTick(() => autosize());
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    send();
  }
}

function onInput(): void {
  autosize();
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
  nextTick(() => autosize());
});

function formatCommentTime(time: string | null): string {
  return time ?? '';
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Ник (глобальный) -->
    <div class="flex flex-col gap-1">
      <label class="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">Твой ник</label>
      <input
        v-model="nickname"
        type="text"
        placeholder="Как тебя подписать? (сохраняется для всех чатов)"
        class="rounded-btn bg-card-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none"
        :disabled="isSaving"
      />
    </div>

    <!-- Лента -->
    <div ref="scrollRef" class="flex max-h-[50vh] flex-col gap-3 overflow-y-auto rounded-card bg-card-bg p-3">
      <div v-if="isLoading" class="flex items-center justify-center gap-2 py-10 text-xs text-fg-muted">
        <Spinner size="sm" />
        Загружаем чат…
      </div>

      <div v-else-if="comments.length === 0 && !isSaving" class="py-8 text-center text-xs text-fg-muted">
        Пока никто не написал. Будь первым.
      </div>

      <template v-else>
        <div
          v-for="(c, index) in comments"
          :key="index"
          class="flex flex-col gap-0.5 rounded-btn bg-bg-elevated/50 px-3 py-2"
        >
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-medium text-active">{{ c.nickname }}</p>
            <p v-if="c.time" class="text-[10px] text-fg-subtle">{{ formatCommentTime(c.time) }}</p>
          </div>
          <p class="whitespace-pre-line text-sm text-fg">{{ c.text }}</p>
        </div>
      </template>

      <!-- Индикатор отправки (внизу ленты) -->
      <div
        v-if="isSaving"
        class="flex items-center justify-center gap-2 rounded-btn bg-bg-elevated/50 px-3 py-2 text-xs text-fg-muted"
      >
        <Spinner size="sm" />
        Отправляем…
      </div>
    </div>

    <!-- Ввод -->
    <div class="flex flex-col gap-1">
      <div class="flex items-end gap-2">
        <textarea
          ref="textareaRef"
          v-model="draft"
          :rows="MIN_ROWS"
          placeholder="Написать комментарий… (Ctrl+Enter — отправить)"
          class="flex-1 resize-none rounded-btn bg-card-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none"
          :disabled="isSaving || isLoading"
          @input="onInput"
          @keydown="onKeydown"
        />
        <IconButton
          :icon="isSaving ? 'spinner' : 'arrow-up'"
          :icon-class="isSaving ? 'animate-spin' : ''"
          variant="active"
          :label="isSaving ? 'Отправляем…' : 'Отправить'"
          :disabled="!canSend()"
          @click="send"
        />
      </div>
      <p v-if="!nickname.trim()" class="text-[10px] text-amber-400 px-1">Введи ник, чтобы отправлять комментарии.</p>
    </div>
  </div>
</template>
