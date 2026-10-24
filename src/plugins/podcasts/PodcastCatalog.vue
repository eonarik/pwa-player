<!-- src/plugins/podcasts/PodcastCatalog.vue -->
<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { podcastService } from './PodcastService'
import {
  addSubscription,
  removeSubscription,
  getSubscriptions,
} from './PodcastStorage'
import type { Podcast, Episode } from './types'
import { PLUGIN_ID, PODCAST_COUNTRIES as COUNTRIES, PODCAST_GENRES as GENRES } from './constants'
import CatalogLayout from '@/components/catalog/CatalogLayout.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import AddRemoveButton from '@/components/ui/AddRemoveButton.vue'
import Icon from '@/components/ui/Icon.vue'
import type { Track } from '@/types/track'

const router = useRouter()
const player = usePlayerStore()

const SEARCH_STORAGE_KEY = 'podcasts:searchQuery'
const LIMIT_STORAGE_KEY = 'podcasts:topLimit'
const MAX_TOP_SIZE = 200

const country = ref(localStorage.getItem('podcasts:country') || 'ru')
const genre = ref(localStorage.getItem('podcasts:genre') || '')
const searchQuery = ref(localStorage.getItem(SEARCH_STORAGE_KEY) || '')
const debouncedQuery = ref(searchQuery.value)
const topLimit = ref(Number(localStorage.getItem(LIMIT_STORAGE_KEY)) || 15)

const currentPage = ref(1)
const hasMore = ref(true)

const isLoading = ref(false)
const isStale = ref(false)
const error = ref('')
const podcasts = ref<Podcast[]>([])
const isLoadingSubscription = ref<string | null>(null)
const subscribedUrls = ref<Set<string>>(new Set())

let searchTimer: ReturnType<typeof setTimeout> | null = null

const isSearchMode = computed(() => debouncedQuery.value.trim().length > 0)

const listTitle = computed(() => {
  if (isSearchMode.value) return `Поиск: «${debouncedQuery.value.trim()}»`
  const c = COUNTRIES.find((x) => x.code === country.value)?.label ?? country.value
  const g = GENRES.find((x) => x.id === genre.value)?.label ?? ''
  return g && g !== 'Все жанры' ? `Топ: ${g} (${c})` : `Топ подкастов (${c})`
})

async function refreshSubscriptions() {
  const subs = await getSubscriptions()
  subscribedUrls.value = new Set(subs.map(s => s.podcast.feedUrl))
}

function isSubscribedPodcast(podcast: Podcast): boolean {
  return subscribedUrls.value.has(podcast.feedUrl)
}

function isCurrentPodcastPlaying(podcast: Podcast): boolean {
  if (!player.isPlaying || !player.currentTrack) return false
  return player.currentTrack.artist === podcast.title
}

function isCurrentPodcast(podcast: Podcast): boolean {
  if (!player.currentTrack) return false
  return player.currentTrack.artist === podcast.title
}

async function getOrLoadEpisodes(podcast: Podcast): Promise<Episode[] | null> {
  const subs = await getSubscriptions()
  const existing = subs.find((s) => s.podcast.feedUrl === podcast.feedUrl)
  if (existing && existing.episodes.length > 0) return existing.episodes

  isLoadingSubscription.value = podcast.id
  try {
    const { podcast: loaded, episodes } = await podcastService.fetchFeed(podcast.feedUrl)
    if (!existing) {
      await addSubscription({ podcast: loaded, episodes, updatedAt: Date.now() })
      podcasts.value = [...podcasts.value]
      await refreshSubscriptions()
    }
    return episodes
  } catch (err) {
    console.error('[podcasts] feed load failed', err)
    error.value = 'Не удалось загрузить RSS'
    return null
  } finally {
    isLoadingSubscription.value = null
  }
}

async function togglePlayPodcast(podcast: Podcast): Promise<void> {
  if (isCurrentPodcastPlaying(podcast)) { player.toggle(); return }

  const episodes = await getOrLoadEpisodes(podcast)
  if (!episodes || episodes.length === 0) return

  const tracks: Track[] = episodes.map((ep) => ({
    id: `podcast:${podcast.id}:${ep.id}`,
    pluginId: PLUGIN_ID,
    title: ep.title,
    artist: podcast.title,
    album: podcast.title,
    duration: ep.durationSec ?? 0,
    filename: '',
    source: ep.audioUrl,
    coverUrl: ep.image || podcast.image || undefined,
  }))
  player.playAll(tracks)
}

async function onAddClick(podcast: Podcast): Promise<void> {
  if (isLoadingSubscription.value || isSubscribedPodcast(podcast)) return
  isLoadingSubscription.value = podcast.id
  try {
    const { podcast: loaded, episodes } = await podcastService.fetchFeed(podcast.feedUrl)
    await addSubscription({ podcast: loaded, episodes, updatedAt: Date.now() })
    await refreshSubscriptions()
    podcasts.value = [...podcasts.value]
  } catch (err) {
    console.error('[podcasts] add failed', err)
    error.value = 'Не удалось загрузить RSS'
  } finally {
    isLoadingSubscription.value = null
  }
}

async function onRemoveClick(podcast: Podcast): Promise<void> {
  await removeSubscription(podcast.feedUrl)
  await refreshSubscriptions()
  podcasts.value = [...podcasts.value]
}

function onOpenClick(podcast: Podcast): void {
  if (!isSubscribedPodcast(podcast)) {
    void onAddClick(podcast)
  }
  router.push({ name: 'podcast-detail', params: { feedUrl: encodeURIComponent(podcast.feedUrl) } })
}

async function loadTop(page = 1): Promise<void> {
  isLoading.value = true
  isStale.value = false
  error.value = ''
  try {
    const fetchLimit = Math.min(page * topLimit.value, MAX_TOP_SIZE)
    const all = await podcastService.getTopPodcasts(country.value, genre.value || undefined, fetchLimit)
    if (all.length === 0) {
      podcasts.value = []
      hasMore.value = false
      error.value = 'Не удалось загрузить топ'
      return
    }
    const from = (page - 1) * topLimit.value
    const to = page * topLimit.value
    podcasts.value = all.slice(from, to)
    hasMore.value = all.length >= fetchLimit && fetchLimit < MAX_TOP_SIZE
  } catch {
    podcasts.value = []
    hasMore.value = false
    error.value = 'Не удалось загрузить топ'
  } finally {
    isLoading.value = false
  }
}

async function loadSearch(query: string): Promise<void> {
  isLoading.value = true
  isStale.value = false
  error.value = ''
  try {
    const data = await podcastService.searchItunes(query, 20)
    podcasts.value = data
    hasMore.value = false
    if (data.length === 0) error.value = 'Ничего не найдено'
  } catch {
    podcasts.value = []
    error.value = 'Ошибка поиска'
  } finally {
    isLoading.value = false
  }
}

async function load(): Promise<void> {
  if (isSearchMode.value) await loadSearch(debouncedQuery.value.trim())
  else await loadTop(currentPage.value)
}

watch(searchQuery, (value) => {
  localStorage.setItem(SEARCH_STORAGE_KEY, value)
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    const next = value.trim()
    if (next === debouncedQuery.value.trim()) return
    debouncedQuery.value = value
    currentPage.value = 1
    void load()
  }, 500)
})

watch([country, genre, topLimit], () => {
  localStorage.setItem('podcasts:country', country.value)
  localStorage.setItem('podcasts:genre', genre.value)
  localStorage.setItem(LIMIT_STORAGE_KEY, String(topLimit.value))
  currentPage.value = 1
  if (!isSearchMode.value) void loadTop(currentPage.value)
})

watch(currentPage, (page) => {
  if (isSearchMode.value) return
  void loadTop(page)
})

function clearSearch(): void {
  searchQuery.value = ''
  debouncedQuery.value = ''
  localStorage.removeItem(SEARCH_STORAGE_KEY)
  currentPage.value = 1
  void loadTop(currentPage.value)
}

function retryLoad(): void {
  if (isSearchMode.value) void loadSearch(debouncedQuery.value.trim())
  else void loadTop(currentPage.value)
}

onMounted(async () => {
  await refreshSubscriptions()
  void load()
})
</script>

<template>
  <CatalogLayout title="Каталог подкастов" back-label="К моим подкастам" :list-title="listTitle"
    :search-query="searchQuery" :show-clear="isSearchMode" :is-loading="isLoading" :is-stale="isStale" :error="error"
    :is-empty="podcasts.length === 0 && !isLoading && !error" :current-limit="topLimit" :current-page="currentPage"
    :has-more="hasMore" :show-pagination="podcasts.length > 0" @update:search-query="(v) => (searchQuery = v)"
    @clear="clearSearch" @back="router.push({ name: 'podcasts' })" @update:current-limit="(v) => (topLimit = v)"
    @prev="currentPage--" @next="currentPage++">
    <template #filters>
      <div class="flex flex-wrap items-center gap-2">
        <DropdownMenu :width="160" align="left">
          <template #trigger="{ toggle, setTriggerRef }">
            <button :ref="setTriggerRef" type="button"
              class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
              @click.stop="toggle">
              {{COUNTRIES.find((c) => c.code === country)?.label}}
              <Icon name="chevron-down" w="w-3" h="h-3" />
            </button>
          </template>
          <template #default="{ close }">
            <div class="max-h-[50vh] overflow-y-auto">
              <button v-for="c in COUNTRIES" :key="c.code" type="button"
                class="block w-full px-4 py-2 text-left text-xs transition hover:bg-hover-bg"
                :class="country === c.code ? 'text-active font-medium' : 'text-fg'" @click="country = c.code; close()">
                {{ c.label }}
              </button>
            </div>
          </template>
        </DropdownMenu>

        <DropdownMenu :width="200" align="left">
          <template #trigger="{ toggle, setTriggerRef }">
            <button :ref="setTriggerRef" type="button"
              class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
              @click.stop="toggle">
              {{GENRES.find((g) => g.id === genre)?.label}}
              <Icon name="chevron-down" w="w-3" h="h-3" />
            </button>
          </template>
          <template #default="{ close }">
            <button v-for="g in GENRES" :key="g.id" type="button"
              class="block w-full px-4 py-2 text-left text-xs transition hover:bg-hover-bg"
              :class="genre === g.id ? 'text-active font-medium' : 'text-fg'" @click="genre = g.id; close()">
              {{ g.label }}
            </button>
          </template>
        </DropdownMenu>
      </div>
    </template>

    <template #error-action>
      <button type="button" class="rounded-btn bg-card-bg px-4 py-2 text-xs text-fg transition hover:bg-hover-bg"
        @click="retryLoad">
        Попробовать еще раз
      </button>
    </template>

    <template #list>
      <div v-for="pod in podcasts" :key="pod.id" class="flex items-center gap-3 rounded-btn px-3 py-2 transition"
        :class="isCurrentPodcast(pod) ? 'bg-active/10' : 'hover:bg-hover-bg'">
        <button type="button" class="flex items-center gap-3 min-w-0 flex-1 text-left" @click="onOpenClick(pod)">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-card-bg">
            <img v-if="pod.image" :src="pod.image" class="h-full w-full object-cover"
              @error="($event.target as HTMLImageElement).style.display = 'none'" />
            <Icon v-else name="radio" w="w-5" h="h-5" class="text-fg-muted" />
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-medium" :class="isCurrentPodcast(pod) ? 'text-active' : 'text-fg'">
              {{ pod.title }}
            </p>
            <p class="truncate text-xs text-fg-muted">{{ pod.author }}</p>
          </div>
        </button>

        <div class="flex shrink-0 items-center gap-1">
          <span v-if="isLoadingSubscription === pod.id" class="text-xs text-fg-muted px-2">
            Загрузка…
          </span>
          <template v-else>
            <button type="button" class="rounded-btn p-1.5 transition"
              :class="isCurrentPodcastPlaying(pod) ? 'text-active hover:bg-hover-bg' : 'text-fg-subtle hover:bg-hover-bg hover:text-fg'"
              :aria-label="isCurrentPodcastPlaying(pod) ? 'Пауза' : 'Играть все эпизоды'"
              v-tooltip="isCurrentPodcastPlaying(pod) ? 'Пауза' : 'Играть все эпизоды'" @click="togglePlayPodcast(pod)">
              <Icon :name="isCurrentPodcastPlaying(pod) ? 'pause' : 'play'" w="w-4" h="h-4" />
            </button>
            <AddRemoveButton :added="isSubscribedPodcast(pod)" @add="onAddClick(pod)" @remove="onRemoveClick(pod)" />
          </template>
        </div>
      </div>
    </template>
  </CatalogLayout>
</template>
