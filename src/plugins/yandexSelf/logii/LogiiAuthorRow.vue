<!-- src/plugins/yandexSelf/logii/LogiiAuthorRow.vue -->

<script setup lang="ts">
import { ref, watch } from 'vue';
import Icon from '@/components/atoms/Icon.vue';
import IconButton from '@/components/atoms/IconButton.vue';
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
    isNavigated: boolean;
    isEditMode: boolean;
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

// --- Teleport-кнопки: позиционирование относительно строки ---

const rowRef = ref<HTMLElement | null>(null);
const buttonPos = ref<{ x: number; y: number } | null>(null);
const isHovering = ref(false);

function updatePosition(): void {
  if (!rowRef.value) {
    buttonPos.value = null;
    return;
  }
  const rect = rowRef.value.getBoundingClientRect();
  buttonPos.value = {
    x: rect.right,
    y: rect.top + rect.height / 2,
  };
}

function onRowEnter(): void {
  isHovering.value = true;
  updatePosition();
}

function onRowLeave(): void {
  isHovering.value = false;
}

function onScrollOrResize(): void {
  updatePosition();
}

watch(() => rowRef.value, () => {
  updatePosition();
});

window.addEventListener('scroll', onScrollOrResize, true);
window.addEventListener('resize', onScrollOrResize);
</script>

<template>
  <div
    ref="rowRef"
    class="group relative"
    :data-testid="rowTestId()"
    @mouseenter="onRowEnter"
    @mouseleave="onRowLeave"
  >
    <button
      type="button"
      class="flex w-full items-center rounded-btn border-l-2 border-transparent transition"
      :class="[
        isNavigated ? 'bg-active/10 text-active' : 'text-fg hover:bg-hover-bg',
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

    <!-- Кнопки переименования/удаления, телепортированные в body -->
    <Teleport to="body">
      <div
        v-if="isHovering && !isCollapsed && buttonPos && isEditMode"
        class="fixed z-[100] flex items-center gap-0.5 rounded-l-btn bg-bg-elevated transition-opacity duration-200"
        :style="{
          left: buttonPos.x + 'px',
          top: buttonPos.y + 'px',
          transform: 'translateY(-50%)',
        }"
        @mouseenter="isHovering = true"
        @mouseleave="isHovering = false"
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
    </Teleport>
  </div>
</template>
