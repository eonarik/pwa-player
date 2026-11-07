<!-- src/plugins/yandexSelf/logii/LogiiAuthorsColumn.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { usePlayerStore } from '@/stores/player';
import Icon from '@/components/ui/Icon.vue';
import IconButton from '@/components/ui/IconButton.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { modalService } from '@/services/ui/ModalService';
import { toastService } from '@/services/ui/ToastService';
import { urlPathToSegments } from '@/utils/urlPath';
import { authorAvatarColor } from './authorColor';
import { useYandexSelfWrites } from './useYandexSelfWrites';
import CreateFolderModal from './CreateFolderModal.vue';
import { yandexSelfService } from '../YandexSelfService';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import type { LogiiAuthorItem } from './useLogiiData';
import type { Track } from '@/types/track';
import type { FolderRef } from '@/types/folder';

const props = defineProps<{
  authors: LogiiAuthorItem[];
  currentAuthorName: string | null;
  isLoading: boolean;
  isCollapsed: boolean;
  allTracksByAuthor: Map<string, Track[]>;
  seasonFolder: FolderRef | null;
}>();

const emit = defineEmits<{
  (e: 'select', author: LogiiAuthorItem): void;
  (e: 'toggle-collapsed'): void;
  (e: 'play-author', author: LogiiAuthorItem): void;
}>();

const router = useRouter();
const player = usePlayerStore();
const { currentTrack, isPlaying } = storeToRefs(player);

const { isWriting, renameFolder, removeResource } = useYandexSelfWrites();

const currentTrackId = computed(() => currentTrack.value?.id ?? null);

const trackIdsByAuthor = computed<Map<string, Set<string>>>(() => {
  const map = new Map<string, Set<string>>();
  for (const [authorUrlPath, tracks] of props.allTracksByAuthor.entries()) {
    const ids = new Set<string>();
    for (const t of tracks) ids.add(t.id);
    map.set(authorUrlPath, ids);
  }
  return map;
});

function rowTestId(author: LogiiAuthorItem): string {
  return `author-row-${author.folderName}`;
}
function playTestId(author: LogiiAuthorItem): string {
  return `author-play-${author.folderName}`;
}
function renameTestId(author: LogiiAuthorItem): string {
  return `author-rename-${author.folderName}`;
}
function deleteTestId(author: LogiiAuthorItem): string {
  return `author-delete-${author.folderName}`;
}

function initialOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed[0]!.toUpperCase();
}
function avatarColor(author: LogiiAuthorItem): string {
  return authorAvatarColor(author.folderName);
}

function isAuthorPlaying(author: LogiiAuthorItem): boolean {
  const ids = trackIdsByAuthor.value.get(author.urlPath);
  if (!ids || !currentTrackId.value) return false;
  return ids.has(currentTrackId.value) && isPlaying.value;
}
function isAuthorCurrent(author: LogiiAuthorItem): boolean {
  const ids = trackIdsByAuthor.value.get(author.urlPath);
  if (!ids || !currentTrackId.value) return false;
  return ids.has(currentTrackId.value);
}
function hasTracks(author: LogiiAuthorItem): boolean {
  const tracks = props.allTracksByAuthor.get(author.urlPath);
  return Boolean(tracks && tracks.length > 0);
}

function onPlayAuthor(author: LogiiAuthorItem, e: MouseEvent): void {
  e.stopPropagation();
  emit('play-author', author);
}

// --- Создание ---

async function openCreateModal(): Promise<void> {
  if (!props.seasonFolder || isWriting.value) return;

  const season = props.seasonFolder;

  await modalService.show<string | null>({
    title: 'Новый автор',
    type: 'custom',
    component: CreateFolderModal,
    props: {
      title: 'Новый автор',
      label: 'Имя автора',
      placeholder: 'userA',
      namePrefix: '',
      submitLabel: 'Создать',
      validateName: (name: string) => {
        if (!name.trim()) return 'Введите имя автора';
        if (/[\\/:*?"<>|]/.test(name)) return 'Имя не должно содержать \\ / : * ? " < > |';
        return null;
      },
      onSubmit: async (finalName: string) => {
        await yandexSelfService.createFolder(season.urlPath, finalName);

        const plugin = await loadPlugin('yandex-self');
        if (plugin.scanFolder) {
          const context = createPluginContext('yandex-self');
          await plugin.scanFolder(context, season.id, { recursive: false, force: true });
        }

        const fullPath = season.urlPath ? `${season.urlPath}/${finalName}` : finalName;
        toastService.success(`Автор «${finalName}» создан`);
        return fullPath;
      },
    },
    disableBackdropClose: true,
  });
}

// --- Переименование ---

async function openRenameModal(author: LogiiAuthorItem, e: MouseEvent): Promise<void> {
  e.stopPropagation();
  if (isWriting.value) return;

  const seasonPath = props.seasonFolder?.urlPath ?? '';
  const oldUrlPath = author.urlPath;
  const oldName = author.folderName;

  const newPathForName = (name: string): string => (seasonPath ? `${seasonPath}/${name}` : name);

  await modalService.show<string | null>({
    title: 'Переименовать автора',
    type: 'custom',
    component: CreateFolderModal,
    props: {
      title: 'Переименовать автора',
      label: 'Новое имя',
      placeholder: oldName,
      namePrefix: '',
      initialName: oldName,
      submitLabel: 'Сохранить',
      validateName: (name: string) => {
        if (!name.trim()) return 'Введите имя';
        if (name === oldName) return 'Имя не изменилось';
        if (/[\\/:*?"<>|]/.test(name)) return 'Имя не должно содержать \\ / : * ? " < > |';
        return null;
      },
      onSubmit: async (newName: string) => {
        const newUrlPath = newPathForName(newName);
        const ok = await renameFolder(oldUrlPath, newUrlPath);
        if (!ok) throw new Error('Не удалось переименовать');

        if (props.currentAuthorName === oldName) {
          router.replace({
            name: 'folder',
            params: { pluginId: 'yandex-self', path: urlPathToSegments(newUrlPath) },
          });
        }

        return newUrlPath;
      },
    },
    disableBackdropClose: true,
  });
}

// --- Удаление ---

async function onDeleteAuthor(author: LogiiAuthorItem, e: MouseEvent): Promise<void> {
  e.stopPropagation();
  if (isWriting.value) return;

  const confirmed = window.confirm(
    `Удалить автора «${author.folderName}» и всё его содержимое? Это действие необратимо.`,
  );
  if (!confirmed) return;

  const seasonPath = props.seasonFolder?.urlPath ?? '';
  const wasCurrent = props.currentAuthorName === author.folderName;

  const ok = await removeResource(author.urlPath, seasonPath);
  if (!ok) return;

  if (wasCurrent && props.seasonFolder) {
    router.replace({
      name: 'folder',
      params: { pluginId: 'yandex-self', path: urlPathToSegments(props.seasonFolder.urlPath) },
    });
  }
}
</script>

<template>
  <aside
    class="hidden shrink-0 overflow-y-auto border-r border-hover-bg bg-bg-elevated/40 transition-all duration-200 md:block"
    :class="isCollapsed ? 'w-14' : 'w-44'"
  >
    <div class="p-2">
      <div class="flex items-center justify-between pb-2 gap-1">
        <p v-if="!isCollapsed" class="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">Авторы</p>
        <div class="flex items-center gap-0.5">
          <IconButton
            v-if="!isCollapsed && seasonFolder"
            icon="plus"
            variant="ghost"
            size="sm"
            label="Добавить автора"
            data-testid="author-add"
            :disabled="isWriting"
            :icon-class="isWriting ? 'animate-spin' : ''"
            @click="openCreateModal"
          />
          <button
            type="button"
            class="w-8 h-8 rounded-btn p-0.5 text-fg-subtle transition hover:bg-hover-bg hover:text-fg"
            :aria-label="isCollapsed ? 'Развернуть авторов' : 'Свернуть авторов'"
            @click="emit('toggle-collapsed')"
          >
            <Icon :name="isCollapsed ? 'chevron-right' : 'chevron-left'" w="w-3.5" h="h-3.5" />
          </button>
        </div>
      </div>

      <div v-if="isLoading" class="flex justify-center py-4">
        <Spinner size="sm" />
      </div>

      <template v-else>
        <div v-for="a in authors" :key="a.urlPath" class="group relative" :data-testid="rowTestId(a)">
          <button
            type="button"
            class="flex w-full items-center rounded-btn transition"
            :class="[
              currentAuthorName === a.folderName ? 'bg-active/10 text-active' : 'text-fg hover:bg-hover-bg',
              isCollapsed ? 'justify-center px-1 py-2' : 'gap-2 px-2 py-1.5',
            ]"
            :title="isCollapsed ? a.folderName : undefined"
            @click="emit('select', a)"
          >
            <span class="relative inline-flex shrink-0">
              <span
                class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-white transition"
                :style="{ backgroundColor: avatarColor(a) }"
              >
                {{ initialOf(a.folderName) }}
              </span>

              <span
                role="button"
                tabindex="0"
                class="absolute inset-0 flex items-center justify-center rounded-full bg-bg/50 transition"
                :class="[
                  isAuthorCurrent(a) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                  hasTracks(a) ? 'cursor-pointer' : 'cursor-not-allowed',
                ]"
                :aria-label="isAuthorPlaying(a) ? 'Пауза' : 'Играть все треки автора'"
                :aria-disabled="!hasTracks(a)"
                :data-testid="playTestId(a)"
                @click="onPlayAuthor(a, $event)"
                @keydown.enter.prevent="onPlayAuthor(a, $event as unknown as MouseEvent)"
                @keydown.space.prevent="onPlayAuthor(a, $event as unknown as MouseEvent)"
              >
                <Icon
                  :name="isAuthorPlaying(a) ? 'pause' : 'play'"
                  w="w-3.5"
                  h="h-3.5"
                  class="text-white drop-shadow"
                  :class="isAuthorPlaying(a) ? '' : 'translate-x-[1px]'"
                />
              </span>
            </span>

            <span v-if="!isCollapsed" class="truncate text-sm">{{ a.folderName }}</span>
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
              :data-testid="renameTestId(a)"
              @click="openRenameModal(a, $event)"
            />
            <IconButton
              icon="trash"
              variant="danger"
              size="md"
              label="Удалить автора"
              :disabled="isWriting"
              :data-testid="deleteTestId(a)"
              @click="onDeleteAuthor(a, $event)"
            />
          </div>
        </div>

        <p v-if="authors.length === 0" class="px-3 py-2 text-center text-xs text-fg-muted">—</p>
      </template>
    </div>
  </aside>
</template>
