<!-- src/plugins/yandexSelf/logii/LogiiChangesButton.vue -->

<script setup lang="ts">
import { ref } from 'vue';
import Icon from '@/components/atoms/Icon.vue';
import type { LogiiChangeEvent } from './composables/useLogiiChanges';

defineProps<{
  unreadCount: number;
  events: LogiiChangeEvent[];
}>();

const emit = defineEmits<{
  (e: 'navigate', urlPath: string): void;
  (e: 'clear'): void;
}>();

const isOpen = ref(false);

function onToggle(): void {
  isOpen.value = !isOpen.value;
}

function onClose(): void {
  isOpen.value = false;
}

function onNavigate(urlPath: string): void {
  emit('navigate', urlPath);
  onClose();
}

function onClear(): void {
  emit('clear');
  onClose();
}

const KIND_LABELS: Record<string, string> = {
  added: 'Добавлен',
  modified: 'Изменен',
  removed: 'Удален',
};

const KIND_ICONS: Record<string, string> = {
  added: 'plus',
  modified: 'pencil',
  removed: 'trash',
};

function iconFor(kind: string): string {
  return KIND_ICONS[kind] ?? 'file';
}

function labelFor(kind: string): string {
  return KIND_LABELS[kind] ?? '';
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="w-8 h-8 rounded-btn p-0.5 text-fg-subtle transition hover:bg-hover-bg hover:text-fg inline-flex items-center justify-center relative"
      aria-label="Уведомления об изменениях"
      data-testid="logii-changes-toggle"
      @click="onToggle"
    >
      <Icon name="bell" w="w-4" h="h-4" />
      <span
        v-if="unreadCount > 0"
        class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-bg tabular-nums"
        data-testid="logii-changes-badge"
      >
        {{ unreadCount > 9 ? '9+' : unreadCount }}
      </span>
    </button>

    <div
      v-if="isOpen && events.length > 0"
      class="absolute right-0 top-full z-30 mt-1 w-72 rounded-card border border-hover-bg bg-bg-elevated shadow-lg"
      data-testid="logii-changes-panel"
    >
      <div class="flex items-center justify-between gap-2 border-b border-hover-bg px-3 py-2">
        <p class="text-xs font-medium text-fg">Изменения</p>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="rounded-btn px-2 py-0.5 text-[10px] text-fg-muted transition hover:text-fg"
            data-testid="logii-changes-clear"
            @click="onClear"
          >
            Очистить
          </button>
          <button
            type="button"
            class="rounded-btn p-0.5 text-fg-muted transition hover:text-fg"
            aria-label="Закрыть"
            data-testid="logii-changes-close"
            @click="onClose"
          >
            <Icon name="x" w="w-3.5" h="w-3.5" />
          </button>
        </div>
      </div>

      <ul class="max-h-64 overflow-y-auto p-1">
        <li
          v-for="(ev, idx) in events.slice(0, 50)"
          :key="idx"
          class="group flex items-start gap-2 rounded-btn px-2 py-1.5 text-xs transition hover:bg-hover-bg cursor-pointer"
          :data-testid="`logii-change-item-${idx}`"
          @click="onNavigate(ev.folderUrlPath)"
        >
          <span class="mt-0.5 shrink-0 text-fg-subtle">
            <Icon :name="iconFor(ev.kind)" w="w-3" h="w-3" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-fg">{{ ev.file.name }}</p>
            <p class="truncate text-[10px] text-fg-subtle">
              {{ labelFor(ev.kind) }} &middot; {{ ev.folderUrlPath.split('/').pop() ?? '' }}
            </p>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
