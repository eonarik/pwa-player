<!-- src/plugins/yandexSelf/logii/LogiiAuthorRow.vue -->

<script setup lang="ts">
import Icon from '@/components/ui/Icon.vue';
import IconButton from '@/components/ui/IconButton.vue';
import { authorAvatarColor } from './authorColor';
import type { LogiiAuthorItem } from './useLogiiData';

const props = withDefaults(
  defineProps<{
    author: LogiiAuthorItem;
    isCollapsed: boolean;
    isWriting: boolean;
    hasTracks: boolean;
    isAuthorCurrent: boolean;
    isAuthorPlaying: boolean;
  }>(),
  {},
);

const emit = defineEmits<{
  (e: 'select'): void;
  (e: 'play', event: MouseEvent): void;
  (e: 'rename', event: MouseEvent): void;
  (e: 'delete', event: MouseEvent): void;
}>();

function rowTestId(): string {
  return `author-row-${props.author.folderName}`;
}
function playTestId(): string {
  return `author-play-${props.author.folderName}`;
}
function renameTestId(): string {
  return `author-rename-${props.author.folderName}`;
}
function deleteTestId(): string {
  return `author-delete-${props.author.folderName}`;
}

function initialOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed[0]!.toUpperCase();
}

function avatarColor(): string {
  return authorAvatarColor(props.author.folderName);
}
</script>

<template>
  <div class="group relative" :data-testid="rowTestId()">
    <button
      type="button"
      class="flex w-full items-center rounded-btn transition"
      :class="[
        isAuthorCurrent ? 'bg-active/10 text-active' : 'text-fg hover:bg-hover-bg',
        isCollapsed ? 'justify-center px-1 py-2' : 'gap-2 px-2 py-1.5',
      ]"
      :title="isCollapsed ? author.folderName : undefined"
      @click="emit('select')"
    >
      <span class="relative inline-flex shrink-0">
        <span
          class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-white transition"
          :style="{ backgroundColor: avatarColor() }"
        >
          {{ initialOf(author.folderName) }}
        </span>

        <span
          role="button"
          tabindex="0"
          class="absolute inset-0 flex items-center justify-center rounded-full bg-bg/50 transition"
          :class="[
            isAuthorCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            hasTracks ? 'cursor-pointer' : 'cursor-not-allowed',
          ]"
          :aria-label="isAuthorPlaying ? 'Пауза' : 'Играть все треки автора'"
          :aria-disabled="!hasTracks"
          :data-testid="playTestId()"
          @click="emit('play', $event)"
          @keydown.enter.prevent="emit('play', $event as unknown as MouseEvent)"
          @keydown.space.prevent="emit('play', $event as unknown as MouseEvent)"
        >
          <Icon
            :name="isAuthorPlaying ? 'pause' : 'play'"
            w="w-3.5"
            h="h-3.5"
            class="text-white drop-shadow"
            :class="isAuthorPlaying ? '' : 'translate-x-[1px]'"
          />
        </span>
      </span>

      <span v-if="!isCollapsed" class="truncate text-sm">{{ author.folderName }}</span>
    </button>

    <div
      v-if="!isCollapsed"
      class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pr-1 opacity-0 transition group-hover:opacity-100 bg-bg-elevated/80"
    >
      <IconButton
        icon="pencil"
        variant="ghost"
        size="md"
        label="Переименовать автора"
        :disabled="isWriting"
        :data-testid="renameTestId()"
        @click="emit('rename', $event)"
      />
      <IconButton
        icon="trash"
        variant="danger"
        size="md"
        label="Удалить автора"
        :disabled="isWriting"
        :data-testid="deleteTestId()"
        @click="emit('delete', $event)"
      />
    </div>
  </div>
</template>
