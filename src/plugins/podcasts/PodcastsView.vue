<!-- src/plugins/podcasts/PodcastsView.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { getSubscriptions, removeSubscription } from './PodcastStorage'
import type { Subscription } from './types'
import { PLUGIN_ID } from './constants'
import IconPlus from '@/components/icons/IconPlus.vue'
import IconRadio from '@/components/icons/IconRadio.vue'
import IconX from '@/components/icons/IconX.vue'
import IconPlay from '@/components/icons/IconPlay.vue'
import IconPause from '@/components/icons/IconPause.vue'
import SectionTitle from '@/components/ui/SectionTitle.vue'
import type { Track } from '@/types/track'

const router = useRouter()
const player = usePlayerStore()

const subscriptions = ref<Subscription[]>([])

const currentTrackId = computed(() => player.currentTrack?.id ?? null)
const isPlaying = computed(() => player.isPlaying)

function refresh(): void {
  subscriptions.value = getSubscriptions()
}

function openPodcast(feedUrl: string): void {
  router.push({
    name: 'podcast-detail',
    params: { feedUrl: encodeURIComponent(feedUrl) },
  })
}

function openCatalog(): void {
  router.push({ name: 'podcasts-catalog' })
}

function unsubscribe(sub: Subscription, e: Event): void {
  e.stopPropagation()
  const confirmed = window.confirm(`Удалить подкаст «${sub.podcast.title}»?`)
  if (!confirmed) return
  removeSubscription(sub.podcast.feedUrl)
  refresh()
}

function episodeToTrack(
  ep: { id: string; podcastId: string; title: string; audioUrl: string; image: string; durationSec: number | null },
  podcastTitle: string,
  podcastImage: string | undefined,
): Track {
  return {
    id: `podcast:${ep.podcastId}:${ep.id}`,
    pluginId: PLUGIN_ID,
    title: ep.title,
    artist: podcastTitle,
    album: podcastTitle,
    duration: ep.durationSec ?? 0,
    filename: '',
    source: ep.audioUrl,
    coverUrl: ep.image || podcastImage || undefined,
  }
}

function isPodcastPlaying(sub: Subscription): boolean {
  if (!isPlaying.value || !currentTrackId.value) return false
  return sub.episodes.some((ep) => `podcast:${ep.podcastId}:${ep.id}` === currentTrackId.value)
}

function isPodcastCurrent(sub: Subscription): boolean {
  if (!currentTrackId.value) return false
  return sub.episodes.some((ep) => `podcast:${ep.podcastId}:${ep.id}` === currentTrackId.value)
}

function playAllEpisodes(sub: Subscription, e: Event): void {
  e.stopPropagation()
  if (sub.episodes.length === 0) return

  if (isPodcastPlaying(sub)) {
    player.toggle()
    return
  }

  const tracks = sub.episodes.map((ep) =>
    episodeToTrack(
      {
        id: ep.id,
        podcastId: ep.podcastId || sub.podcast.id,
        title: ep.title,
        audioUrl: ep.audioUrl,
        image: ep.image,
        durationSec: ep.durationSec,
      },
      sub.podcast.title,
      sub.podcast.image,
    ),
  )
  player.playAll(tracks)
}

onMounted(() => {
  refresh()
})
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3 border-b border-hover-bg bg-bg z-10">
      <div class="mx-auto flex w-full max-w-3xl items-center justify-between">
        <h1 class="text-lg font-medium text-fg">Подкасты</h1>
        <button type="button"
          class="flex items-center gap-2 rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover"
          @click="openCatalog">
          <IconPlus class="h-4 w-4" />
          Каталог
        </button>
      </div>
    </div>

    <!-- Список -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl py-2">
        <SectionTitle text="Мои подкасты" />

        <div v-if="subscriptions.length === 0"
          class="flex flex-col items-center justify-center py-16 text-sm text-fg-muted">
          <IconRadio class="mb-3 h-10 w-10 text-fg-subtle" />
          <p>Вы пока не подписаны ни на один подкаст.</p>
          <p class="mt-1 text-xs">Откройте каталог, чтобы найти и добавить.</p>
        </div>

        <div v-else class="flex flex-col gap-0.5">
          <div v-for="sub in subscriptions" :key="sub.podcast.id"
            class="group flex items-center gap-3 rounded-btn px-3 py-2 transition cursor-pointer"
            :class="isPodcastCurrent(sub) ? 'bg-active/10' : 'hover:bg-hover-bg'"
            @click="openPodcast(sub.podcast.feedUrl)">
            <!-- Обложка + play/pause -->
            <div
              class="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-card-bg">
              <img v-if="sub.podcast.image" :src="sub.podcast.image" class="h-full w-full object-cover"
                @error="($event.target as HTMLImageElement).style.display = 'none'" />
              <IconRadio v-else class="h-5 w-5 text-fg-muted" />

              <!-- Кнопка play/pause -->
              <button type="button" class="absolute inset-0 flex items-center justify-center transition" :class="isPodcastPlaying(sub)
                ? 'bg-bg/60 opacity-100'
                : 'bg-bg/50 opacity-0 group-hover:opacity-100'"
                :aria-label="isPodcastPlaying(sub) ? 'Пауза' : 'Играть все эпизоды'"
                v-tooltip="isPodcastPlaying(sub) ? 'Пауза' : 'Играть все эпизоды'"
                @click.stop="playAllEpisodes(sub, $event)">
                <IconPause v-if="isPodcastPlaying(sub)" class="h-5 w-5 text-active" />
                <IconPlay v-else class="h-5 w-5 text-fg" />
              </button>
            </div>

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium" :class="isPodcastCurrent(sub) ? 'text-active' : 'text-fg'">
                {{ sub.podcast.title }}
              </p>
              <p class="truncate text-xs text-fg-muted">{{ sub.episodes.length }} эпизодов</p>
            </div>

            <button type="button"
              class="rounded-btn p-1.5 text-fg-subtle opacity-0 transition hover:bg-hover-bg hover:text-red-400 group-hover:opacity-100"
              aria-label="Удалить подкаст" @click="unsubscribe(sub, $event)">
              <IconX class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
