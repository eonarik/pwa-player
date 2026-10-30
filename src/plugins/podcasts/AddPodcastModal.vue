<!-- src/plugins/podcasts/AddPodcastModal.vue -->

<script setup lang="ts">
import { ref } from 'vue';
import { toastService } from '@/services/ui/ToastService';
import { podcastService } from './PodcastService';
import { addSubscription, isSubscribed } from './PodcastStorage';
import { parseOpml } from './parseOpml';
import ModalLayout from '@/components/ui/ModalLayout.vue';
import FormField from '@/components/ui/FormField.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import Spinner from '@/components/ui/Spinner.vue';
import ProgressBar from '@/components/ui/ProgressBar.vue';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'added'): void;
}>();

type Tab = 'url' | 'opml';
const activeTab = ref<Tab>('url');

// --- URL ------------------------------------------------------------

const feedUrl = ref('');
const isAddingUrl = ref(false);

async function submitUrl() {
  const url = feedUrl.value.trim();
  if (!url) return;

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      toastService.error('Ссылка должна начинаться с http:// или https://');
      return;
    }
  } catch {
    toastService.error('Некорректный URL');
    return;
  }

  if (await isSubscribed(url)) {
    toastService.error('Этот подкаст уже добавлен');
    return;
  }

  isAddingUrl.value = true;
  try {
    const { podcast, episodes } = await podcastService.fetchFeed(url);
    await addSubscription({ podcast, episodes, updatedAt: Date.now() });
    toastService.success(`Подкаст «${podcast.title}» добавлен`);
    emit('added');
    emit('close');
  } catch (err) {
    console.error('[podcasts] add by url failed', err);
    toastService.error(err instanceof Error ? err.message : 'Не удалось сохранить подкаст');
  } finally {
    isAddingUrl.value = false;
  }
}

// --- OPML -----------------------------------------------------------

const fileInputRef = ref<HTMLInputElement | null>(null);
const isImporting = ref(false);
const importProgress = ref({ done: 0, total: 0 });
const importedCount = ref(0);
const skippedCount = ref(0);

function triggerFilePicker() {
  fileInputRef.value?.click();
}

async function onFileSelected(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  target.value = '';

  let feeds: Array<{ title: string; feedUrl: string }>;
  try {
    const text = await file.text();
    feeds = parseOpml(text);
  } catch (err) {
    console.error('[podcasts] parse opml failed', err);
    toastService.error('Не удалось прочитать OPML');
    return;
  }

  const unique: typeof feeds = [];
  for (const f of feeds) {
    if (!(await isSubscribed(f.feedUrl))) unique.push(f);
  }

  if (unique.length === 0) {
    toastService.info('Все подкасты из файла уже добавлены');
    return;
  }

  isImporting.value = true;
  importedCount.value = 0;
  skippedCount.value = 0;
  importProgress.value = { done: 0, total: unique.length };

  const CONCURRENCY = 2;
  let cursor = 0;

  const worker = async () => {
    while (cursor < unique.length) {
      const index = cursor++;
      const feed = unique[index]!;
      try {
        const { podcast, episodes } = await podcastService.fetchFeed(feed.feedUrl);
        await addSubscription({ podcast, episodes, updatedAt: Date.now() });
        importedCount.value++;
      } catch (err) {
        console.warn(`[podcasts] failed to import "${feed.feedUrl}"`, err);
        skippedCount.value++;
      } finally {
        importProgress.value = { done: importProgress.value.done + 1, total: unique.length };
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unique.length) }, () => worker()));
    if (importedCount.value > 0) {
      toastService.success(
        `Импортировано подкастов: ${importedCount.value}${skippedCount.value > 0 ? `, ошибок: ${skippedCount.value}` : ''}`,
      );
      emit('added');
      emit('close');
    } else {
      toastService.error('Ни один подкаст не удалось импортировать');
    }
  } finally {
    isImporting.value = false;
  }
}
</script>

<template>
  <ModalLayout
    title="Добавить подкаст"
    max-width="md"
    :disable-backdrop-close="isAddingUrl || isImporting"
    @close="emit('close')"
  >
    <!-- Табы -->
    <div class="mb-4 flex gap-2">
      <button
        type="button"
        class="rounded-btn px-3 py-1.5 text-xs transition"
        :class="activeTab === 'url' ? 'bg-card-bg text-fg font-medium' : 'text-fg-muted hover:text-fg'"
        @click="activeTab = 'url'"
      >
        По ссылке RSS
      </button>
      <button
        type="button"
        class="rounded-btn px-3 py-1.5 text-xs transition"
        :class="activeTab === 'opml' ? 'bg-card-bg text-fg font-medium' : 'text-fg-muted hover:text-fg'"
        @click="activeTab = 'opml'"
      >
        Импорт OPML
      </button>
    </div>

    <!-- Вкладка URL -->
    <form v-if="activeTab === 'url'" class="flex flex-col gap-4" @submit.prevent="submitUrl">
      <p class="text-xs text-fg-muted">
        Введите прямую ссылку на RSS-ленту подкаста (обычно заканчивается на .xml или /feed).
      </p>
      <FormField label="URL RSS-ленты">
        <Input v-model="feedUrl" type="url" placeholder="https://example.com/podcast/feed.xml" required />
      </FormField>
      <div class="mt-2 flex justify-end">
        <Button type="submit" variant="primary" :disabled="!feedUrl.trim() || isAddingUrl">
          {{ isAddingUrl ? 'Загрузка…' : 'Добавить' }}
        </Button>
      </div>
    </form>

    <!-- Вкладка OPML -->
    <div v-if="activeTab === 'opml'" class="flex flex-col gap-4">
      <p class="text-xs text-fg-muted">
        Импортируйте подписки из другого приложения (Apple Podcasts, Overcast, Pocket Casts).
      </p>

      <template v-if="!isImporting">
        <Button variant="secondary" class="w-full py-3" @click="triggerFilePicker"> Выбрать OPML-файл </Button>
      </template>

      <template v-else>
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs text-fg-muted">
            <Spinner size="sm" text="Импорт…" />
            <span class="tabular-nums">{{ importProgress.done }} / {{ importProgress.total }}</span>
          </div>
          <ProgressBar :value="importProgress.done" :max="importProgress.total" />
        </div>
      </template>

      <input
        ref="fileInputRef"
        type="file"
        accept=".opml,.xml,application/xml,text/xml"
        class="hidden"
        @change="onFileSelected"
      />
    </div>
  </ModalLayout>
</template>
