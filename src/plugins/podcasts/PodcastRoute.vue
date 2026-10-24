<!-- src/plugins/podcasts/PodcastRoute.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { podcastService } from './PodcastService'
import {
  getSubscriptions,
  updateSubscription,
  isCacheFresh,
} from './PodcastStorage'
import type { Episode, Subscription } from './types'
import Spinner from '@/components/ui/Spinner.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Icon from '@/components/ui/Icon.vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { PLUGIN_ID } from './constants'
import type { Track } from '@/types/track'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()

const feedUrl = computed(() => decodeURIComponent(String(route.params.feedUrl ?? '')))

const subscription = ref<Subscription | null>(null)
const isRefreshing = ref(false)
const error = ref('')

type SortOrder = 'serial' | 'episodic'

const sortStorageKey = computed(() => `podcasts:sort:${feedUrl.value}`)

const sortOrder = ref<SortOrder>('episodic')

const episodes = computed<Episode[]>(() => subscription.value?.episodes ?? [])

const sortedEpisodes = computed<Episode[]>(() => {
  const eps = [...episodes.value]
  if (sortOrder.value === 'serial') {
    eps.sort((a, b) => a.publishedAt - b.publishedAt)
  } else {
    eps.sort((a, b) => b.publishedAt - a.publishedAt)
  }
  return eps
})

const currentTrackId = computed(() => player.currentTrack?.id ?? null)

function episodeToTrack(ep: Episode): Track {
  return {
    id: `podcast:${ep.podcastId}:${ep.id}`,
    pluginId: PLUGIN_ID,
    title: ep.title,
    artist: subscription.value?.podcast.title ?? '',
    album: subscription.value?.podcast.title ?? '',
    duration: ep.durationSec ?? 0,
    filename: '',
    source: ep.audioUrl,
    coverUrl: ep.image || subscription.value?.podcast.image || undefined,
  }
}

function initSortOrder(): void {
  const stored = localStorage.getItem(sortStorageKey.value) as SortOrder | null
  if (stored === 'serial' || stored === 'episodic') {
    sortOrder.value = stored
    return
  }
  sortOrder.value = 'serial'
}

function toggleSort(): void {
  sortOrder.value = sortOrder.value === 'serial' ? 'episodic' : 'serial'
  localStorage.setItem(sortStorageKey.value, sortOrder.value)
}

async function refresh(): Promise<void> {
  if (!feedUrl.value) return
  isRefreshing.value = true
  error.value = ''

  try {
    const { podcast, episodes } = await podcastService.fetchFeed(feedUrl.value)
    await updateSubscription(feedUrl.value, { episodes, updatedAt: Date.now() })
    subscription.value = {
      podcast,
      episodes,
      updatedAt: Date.now(),
    }
  } catch (err) {
    console.error('[podcasts] refresh failed', err)
    error.value = 'Не удалось обновить ленту'
  } finally {
    isRefreshing.value = false
  }
}

function playEpisode(ep: Episode): void {
  const track = episodeToTrack(ep)
  if (currentTrackId.value === track.id) {
    player.toggle()
    return
  }
  player.setQueue([track], 0)
}

function playAll(): void {
  if (sortedEpisodes.value.length === 0) return
  player.playAll(sortedEpisodes.value.map(episodeToTrack))
}

function isPlayingEpisode(ep: Episode): boolean {
  return currentTrackId.value === `podcast:${ep.podcastId}:${ep.id}` && player.isPlaying
}

function isCurrentEpisode(ep: Episode): boolean {
  return currentTrackId.value === `podcast:${ep.podcastId}:${ep.id}`
}

onMounted(async () => {
  const subs = await getSubscriptions()
  subscription.value = subs.find((s) => s.podcast.feedUrl === feedUrl.value) ?? null

  if (!subscription.value) {
    router.replace({ name: 'podcasts' })
    return
  }

  initSortOrder()

  if (!isCacheFresh(subscription.value)) {
    void refresh()
  }
})

watch(feedUrl, () => {
  initSortOrder()
})
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3 border-b border-hover-bg bg-bg z-10">
      <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <IconButton icon="arrow-left" label="Назад" @click="router.push({ name: 'podcasts' })" />
          <div class="min-w-0">
            <h1 class="truncate text-lg font-medium text-fg">
              {{ subscription?.podcast.title ?? 'Подкаст' }}
            </h1>
            <p class="truncate text-xs text-fg-muted">
              <template v-if="isRefreshing">Обновление…</template>
              <template v-else>{{ sortedEpisodes.length }} эпизодов</template>
            </p>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <Button variant="primary" size="sm" :disabled="sortedEpisodes.length === 0" @click="playAll">
            Играть всё
          </Button>
        </div>
      </div>
    </div>

    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-2">
      <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <div class="flex items-center gap-1">
          <IconButton :icon="sortOrder === 'serial' ? 'arrow-down' : 'arrow-up'"
            :label="sortOrder === 'serial' ? 'Сначала старые' : 'Сначала новые'" @click="toggleSort" />
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl py-2">
        <div v-if="isRefreshing && sortedEpisodes.length === 0" class="flex justify-center py-10">
          <Spinner size="lg" text="Загрузка эпизодов…" />
        </div>

        <div v-if="error" class="text-center py-4 text-sm text-red-400">
          {{ error }}
        </div>

        <EmptyState v-if="sortedEpisodes.length === 0 && !isRefreshing" title="Эпизоды не найдены" />

        <div v-else class="flex flex-col gap-0.5">
          <div v-for="ep in sortedEpisodes" :key="ep.id"
            class="flex items-center gap-3 rounded-btn px-3 py-2 transition hover:bg-hover-bg cursor-pointer"
            :class="isCurrentEpisode(ep) ? 'bg-active/10' : ''" @click="playEpisode(ep)">
            <div
              class="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-card-bg">
              <img v-if="ep.image" :src="ep.image" class="h-full w-full object-cover"
                @error="($event.target as HTMLImageElement).style.display = 'none'" />
              <div class="absolute inset-0 flex items-center justify-center bg-bg/50">
                <Icon :name="isPlayingEpisode(ep) ? 'pause' : 'play'" w="w-4" h="h-4"
                  :class="isPlayingEpisode(ep) ? 'text-active' : 'text-fg'" />
              </div>
            </div>

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-fg" :class="isCurrentEpisode(ep) ? 'text-active' : ''">
                {{ ep.title }}
              </p>
              <p class="truncate text-xs text-fg-muted">
                {{ new Date(ep.publishedAt).toLocaleDateString('ru-RU') }}
                <template v-if="ep.durationSec">
                  · {{ Math.round(ep.durationSec / 60) }} мин
                </template>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
