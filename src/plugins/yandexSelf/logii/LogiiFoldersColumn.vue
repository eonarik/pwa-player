<!-- src/plugins/yandexSelf/logii/LogiiFoldersColumn.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { sortService } from '@/services/sort/SortService';
import Icon from '@/components/atoms/Icon.vue';
import IconButton from '@/components/atoms/IconButton.vue';
import { modalService } from '@/services/ui/ModalService';
import { toastService } from '@/services/ui/ToastService';
import { urlPathToSegments } from '@/utils/urlPath';
import { useYandexSelfWrites } from './useYandexSelfWrites';
import CreateFolderModal from './CreateFolderModal.vue';
import CreateTopsModal, { type CreateTopsResult } from './CreateTopsModal.vue';
import { yandexSelfService } from '../YandexSelfService';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import type { LogiiTrackItem } from './useLogiiData';
import type { FolderRef } from '@/types/folder';
import { logger } from '@/utils/logger';

const props = defineProps<{
  folders: LogiiTrackItem[];
  currentFolderName: string | null;
  hasAuthorIntro: boolean;
  authorIntroFileName: string | null;
  currentAuthorName: string | null;
  authorFolder: FolderRef | null;
  seasonFolder: FolderRef | null;
}>();

const emit = defineEmits<{
  (e: 'select', folder: LogiiTrackItem): void;
  (e: 'select-intro'): void;
}>();

const router = useRouter();
const { isWriting, renameFolder, removeResource } = useYandexSelfWrites();

const sortedFolders = computed(() => {
  const items = props.folders.map((f) => ({ name: f.folderName, folder: f }));
  return sortService.sortByName(items).map((x) => x.folder);
});

const sortIcon = computed(() => (sortService.dir.value === 'asc' ? 'arrow-down' : 'arrow-up'));
const sortLabel = computed(() => sortService.dirLabel);

const isIntroActive = computed(() => Boolean(props.currentAuthorName) && props.currentFolderName === null);

// --- Создание топов ---

async function openCreateTopsModal(): Promise<void> {
  if (!props.authorFolder || isWriting.value) return;

  const author = props.authorFolder;
  const hasIntro = props.hasAuthorIntro;

  await modalService.show<CreateTopsResult | null>({
    title: 'Новые топы',
    type: 'custom',
    component: CreateTopsModal,
    props: {
      hasIntro,
      onSubmit: async ({ count, introName }: CreateTopsResult) => {
        const errors: string[] = [];
        for (let i = 1; i <= count; i++) {
          try {
            await yandexSelfService.createFolder(author.urlPath, String(i));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('уже существует') || msg.includes('409') || msg.includes('Conflict')) {
              // пропускаем
            } else {
              errors.push(`Папка ${i}: ${msg}`);
            }
          }
        }

        if (introName && !hasIntro) {
          try {
            const introPath = author.urlPath ? `${author.urlPath}/${introName}` : introName;
            await yandexSelfService.writeTextFile(introPath, '');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`Intro: ${msg}`);
          }
        }

        const plugin = await loadPlugin('yandex-self');
        if (plugin.scanFolder) {
          const context = createPluginContext('yandex-self');
          await plugin.scanFolder(context, author.id, { recursive: false, force: true });
        }

        if (errors.length > 0) {
          toastService.error(`Создано с ошибками: ${errors.length}`);
          logger.warn('[create-tops] errors', errors);
          return false;
        }

        toastService.success(`Создано топов: ${count}${introName ? ' + Intro' : ''}`);
        return true;
      },
    },
    disableBackdropClose: true,
  });
}

// --- Переименование топа ---

async function openRenameModal(folder: LogiiTrackItem, e: MouseEvent): Promise<void> {
  e.stopPropagation();
  if (isWriting.value || !props.authorFolder) return;

  const authorPath = props.authorFolder.urlPath;
  const oldUrlPath = folder.urlPath;
  const oldName = folder.folderName;

  const newPathForName = (name: string): string => (authorPath ? `${authorPath}/${name}` : name);

  await modalService.show<string | null>({
    title: 'Переименовать топ',
    type: 'custom',
    component: CreateFolderModal,
    props: {
      title: 'Переименовать топ',
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

        if (props.currentFolderName === oldName) {
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

// --- Удаление топа ---

async function onDeleteFolder(folder: LogiiTrackItem, e: MouseEvent): Promise<void> {
  e.stopPropagation();
  if (isWriting.value || !props.authorFolder) return;

  const confirmed = window.confirm(
    `Удалить папку «${folder.folderName}» и всё её содержимое? Это действие необратимо.`,
  );
  if (!confirmed) return;

  const authorPath = props.authorFolder.urlPath;
  const wasCurrent = props.currentFolderName === folder.folderName;

  const ok = await removeResource(folder.urlPath, authorPath);
  if (!ok) return;

  if (wasCurrent && props.authorFolder) {
    router.replace({
      name: 'folder',
      params: { pluginId: 'yandex-self', path: urlPathToSegments(props.authorFolder.urlPath) },
    });
  }
}
</script>

<template>
  <aside class="hidden w-48 shrink-0 overflow-y-auto border-r border-hover-bg bg-bg-elevated/20 md:block">
    <div class="p-2">
      <button
        v-if="hasAuthorIntro && authorIntroFileName"
        type="button"
        class="mb-1 flex w-full items-center gap-2 rounded-btn px-2 py-1.5 text-left text-sm transition"
        :class="isIntroActive ? 'bg-active/10 text-active' : 'text-fg hover:bg-hover-bg'"
        :title="authorIntroFileName"
        data-testid="logii-folder-intro"
        @click="emit('select-intro')"
      >
        <Icon name="file" w="w-4" h="h-4" class="shrink-0 text-fg-muted" />
        <span class="truncate">{{ authorIntroFileName }}</span>
      </button>

      <div v-if="hasAuthorIntro" class="mb-1 border-t border-hover-bg" />

      <div class="flex items-center justify-between pl-2 py-1 gap-1">
        <p class="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">Папки</p>
        <div class="flex items-center gap-0.5">
          <IconButton
            v-if="authorFolder"
            icon="plus"
            variant="ghost"
            size="sm"
            label="Создать топы"
            data-testid="tops-create"
            :disabled="isWriting"
            :icon-class="isWriting ? 'animate-spin' : ''"
            @click="openCreateTopsModal"
          />
          <IconButton :icon="sortIcon" variant="ghost" size="sm" :label="sortLabel" @click="sortService.toggleDir()" />
        </div>
      </div>

      <div
        v-for="f in sortedFolders"
        :key="f.urlPath"
        class="group relative"
        :data-testid="`folder-row-${f.folderName}`"
      >
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-btn px-2 py-1.5 text-left text-sm transition"
          :class="currentFolderName === f.folderName ? 'bg-active/10 text-active' : 'text-fg hover:bg-hover-bg'"
          :data-testid="`logii-folder-${f.folderName}`"
          @click="emit('select', f)"
        >
          <span class="truncate">{{ f.folderName }}</span>
        </button>

        <div
          class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pr-1 opacity-0 transition group-hover:opacity-100 bg-bg-elevated/80"
        >
          <IconButton
            icon="pencil"
            variant="ghost"
            size="md"
            label="Переименовать топ"
            :disabled="isWriting"
            :data-testid="`folder-rename-${f.folderName}`"
            @click="openRenameModal(f, $event)"
          />
          <IconButton
            icon="trash"
            variant="danger"
            size="md"
            label="Удалить топ"
            :disabled="isWriting"
            :data-testid="`folder-delete-${f.folderName}`"
            @click="onDeleteFolder(f, $event)"
          />
        </div>
      </div>

      <p v-if="sortedFolders.length === 0" class="px-3 py-2 text-center text-xs text-fg-muted">—</p>
    </div>
  </aside>
</template>
