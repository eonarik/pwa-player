<!-- src/plugins/podcasts/AddPodcastModal.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { toastService } from '@/services/ui/ToastService'
import { podcastService } from './PodcastService'
import { addSubscription, isSubscribed } from './PodcastStorage'
import { parseOpml } from './parseOpml'
import IconX from '@/components/icons/IconX.vue'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'added'): void
}>()

type Tab = 'url' | 'opml'
const activeTab = ref<Tab>('url')

// --- URL ------------------------------------------------------------

const feedUrl = ref('')
const isAddingUrl = ref(false)

async function submitUrl() {
  const url = feedUrl.value.trim()
  if (!url) return

  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      toastService.error('Ссылка должна начинаться с http:// или https://')
      return
    }
  } catch {
    toastService.error('Некорректный URL')
    return
  }

  if (await isSubscribed(url)) {
    toastService.error('Этот подкаст уже добавлен')
    return
  }

  isAddingUrl.value = true
  try {
    const { podcast, episodes } = await podcastService.fetchFeed(url)
    await addSubscription({ podcast, episodes, updatedAt: Date.now() })
    toastService.success(`Подкаст «${podcast.title}» добавлен`)
    emit('added')
    emit('close')
  } catch (err) {
    console.error('[podcasts] add by url failed', err)
    toastService.error(err instanceof Error ? err.message : 'Не удалось сохранить подкаст')
  } finally {
    isAddingUrl.value = false
  }
}

// --- OPML -----------------------------------------------------------

const fileInputRef = ref<HTMLInputElement | null>(null)
const isImporting = ref(false)
const importProgress = ref({ done: 0, total: 0 })
const importedCount = ref(0)
const skippedCount = ref(0)

function triggerFilePicker() {
  fileInputRef.value?.click()
}

async function onFileSelected(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  target.value = ''

  let feeds: Array<{ title: string; feedUrl: string }>
  try {
    const text = await file.text()
    feeds = parseOpml(text)
  } catch (err) {
    console.error('[podcasts] parse opml failed', err)
    toastService.error('Не удалось прочитать OPML')
    return
  }

  const unique: typeof feeds = []
  for (const f of feeds) {
    if (!(await isSubscribed(f.feedUrl))) unique.push(f)
  }

  if (unique.length === 0) {
    toastService.info('Все подкасты из файла уже добавлены')
    return
  }

  isImporting.value = true
  importedCount.value = 0
  skippedCount.value = 0
  importProgress.value = { done: 0, total: unique.length }

  const CONCURRENCY = 2
  let cursor = 0

  const worker = async () => {
    while (cursor < unique.length) {
      const index = cursor++
      const feed = unique[index]!
      try {
        const { podcast, episodes } = await podcastService.fetchFeed(feed.feedUrl)
        await addSubscription({ podcast, episodes, updatedAt: Date.now() })
        importedCount.value++
      } catch (err) {
        console.warn(`[podcasts] failed to import "${feed.feedUrl}"`, err)
        skippedCount.value++
      } finally {
        importProgress.value = { done: importProgress.value.done + 1, total: unique.length }
      }
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, unique.length) }, () => worker()),
    )
    if (importedCount.value > 0) {
      toastService.success(
        `Импортировано подкастов: ${importedCount.value}${skippedCount.value > 0 ? `, ошибок: ${skippedCount.value}` : ''
        }`,
      )
      emit('added')
      emit('close')
    } else {
      toastService.error('Ни один подкаст не удалось импортировать')
    }
  } finally {
    isImporting.value = false
  }
}

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget && !isAddingUrl.value && !isImporting.value) {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[150] flex items-center justify-center bg-bg/70 px-4" @click="onBackdrop">
      <div class="flex w-full max-w-md flex-col bg-bg-elevated p-5 shadow-xl">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-medium text-fg">Добавить подкаст</h2>
          <button type="button" class="rounded-btn p-1 text-fg-muted transition hover:bg-hover-bg hover:text-fg"
            aria-label="Закрыть" v-tooltip="'Закрыть'" :disabled="isAddingUrl || isImporting" @click="emit('close')">
            <IconX class="h-5 w-5" />
          </button>
        </div>

        <div class="mb-4 flex gap-2">
          <button type="button" class="rounded-btn px-3 py-1.5 text-xs transition"
            :class="activeTab === 'url' ? 'bg-card-bg text-fg font-medium' : 'text-fg-muted hover:text-fg'"
            @click="activeTab = 'url'">
            По ссылке RSS
          </button>
          <button type="button" class="rounded-btn px-3 py-1.5 text-xs transition"
            :class="activeTab === 'opml' ? 'bg-card-bg text-fg font-medium' : 'text-fg-muted hover:text-fg'"
            @click="activeTab = 'opml'">
            Импорт OPML
          </button>
        </div>

        <form v-if="activeTab === 'url'" class="flex flex-col gap-3" @submit.prevent="submitUrl">
          <p class="text-xs text-fg-muted">
            Введите прямую ссылку на RSS-ленту подкаста (обычно заканчивается на .xml или /feed).
          </p>
          <input v-model="feedUrl" type="url" placeholder="https://example.com/podcast/feed.xml" required
            class="w-full rounded-btn bg-card-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none" />
          <div class="mt-2 flex justify-end">
            <button type="submit"
              class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50"
              :disabled="!feedUrl.trim() || isAddingUrl">
              {{ isAddingUrl ? 'Загрузка…' : 'Добавить' }}
            </button>
          </div>
        </form>

        <div v-if="activeTab === 'opml'" class="flex flex-col gap-3">
          <p class="text-xs text-fg-muted">
            Импортируйте подписки из другого приложения (Apple Podcasts, Overcast, Pocket Casts). Выгрузите OPML-файл
            там и загрузите сюда.
          </p>

          <template v-if="!isImporting">
            <button type="button" class="rounded-btn bg-card-bg px-4 py-3 text-sm text-fg transition hover:bg-hover-bg"
              @click="triggerFilePicker">
              Выбрать OPML-файл
            </button>
          </template>

          <template v-else>
            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between text-xs text-fg-muted">
                <span>Импорт…</span>
                <span class="tabular-nums">{{ importProgress.done }} / {{ importProgress.total }}</span>
              </div>
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-hover-bg">
                <div class="h-full bg-accent transition-[width]"
                  :style="{ width: `${importProgress.total > 0 ? (importProgress.done / importProgress.total) * 100 : 0}%` }" />
              </div>
            </div>
          </template>

          <input ref="fileInputRef" type="file" accept=".opml,.xml,application/xml,text/xml" class="hidden"
            @change="onFileSelected" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
