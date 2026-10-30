<!-- src/components/player/FullPlayer.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { useDominantColor } from '@/composables/useDominantColor';
import { rgbToString } from '@/utils/dominantColor';
import { isLinearContent, isLiveStream } from '@/plugins/registry';
import { themeService } from '@/services/ui/ThemeService';
import PlayerProgressBar from './PlayerProgressBar.vue';
import CoverImage from '@/components/ui/CoverImage.vue';
import DislikeButton from '@/components/ui/DislikeButton.vue';
import FavoriteButton from '@/components/ui/FavoriteButton.vue';
import IconButton from '@/components/ui/IconButton.vue';
import Icon from '@/components/ui/Icon.vue';

defineProps<{
  title: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const player = usePlayerStore();
const library = useLibraryStore();

const { currentTrack, isPlaying, currentTime, duration, repeatMode, shuffle, muted, volume } = storeToRefs(player);

const album = computed(() => {
  const id = currentTrack.value?.albumId;
  if (!id) return null;
  return library.getAlbum(id);
});

const albumName = computed(() => album.value?.name ?? '');

const isLive = computed(() => (currentTrack.value ? isLiveStream(currentTrack.value.pluginId) : false));

const coverHasError = ref(false);

const isLinear = computed(() => (currentTrack.value ? isLinearContent(currentTrack.value.pluginId) : false));

watch(
  () => currentTrack.value?.coverUrl,
  () => {
    coverHasError.value = false;
  },
);

const coverSrc = computed(() => album.value?.coverUrl ?? currentTrack.value?.coverUrl ?? null);

const dominantColor = useDominantColor(coverSrc);

const glowStyle = computed(() => {
  if (themeService.current.value === 'radio') {
    return {
      background: 'radial-gradient(ellipse 50% 50% at 50% 65%, rgba(212, 175, 55, 0.4) 0%, rgba(212, 175, 55, 0) 70%)',
    };
  }
  const c = dominantColor.value;
  return {
    background: `radial-gradient(ellipse 50% 50% at 50% 65%, ${rgbToString(c, 0.4)} 0%, ${rgbToString(c, 0)} 70%)`,
  };
});

function onSeek(time: number) {
  player.seek(time);
}

const DRAG_THRESHOLD = 120;
const DAMPING = 0.6;

const rootRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const dragOffset = ref(0);
let startY = 0;

function onPointerDown(e: PointerEvent) {
  if (e.pointerType !== 'touch') return;
  const target = e.target as HTMLElement;
  if (target.closest('button, input, a, [role="button"]')) return;
  startY = e.clientY;
  isDragging.value = true;
  dragOffset.value = 0;
  rootRef.value?.setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return;
  const dy = e.clientY - startY;
  if (dy <= 0) {
    dragOffset.value = 0;
    return;
  }
  dragOffset.value = dy * DAMPING;
}

function onPointerUp(e: PointerEvent) {
  if (!isDragging.value) return;
  const target = e.currentTarget as HTMLElement;
  if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
  if (dragOffset.value >= DRAG_THRESHOLD) {
    dragOffset.value = window.innerHeight;
    setTimeout(() => emit('close'), 200);
  } else {
    dragOffset.value = 0;
  }
  isDragging.value = false;
}

const rootStyle = computed(() => {
  if (!isDragging.value && dragOffset.value === 0) return {};
  return {
    transform: `translateY(${dragOffset.value}px)`,
    transition: isDragging.value ? 'none' : 'transform 200ms ease-out',
  };
});

watch(
  () => currentTrack.value?.id,
  (id) => {
    if (!id) emit('close');
  },
);
</script>

<template>
  <Teleport to="body">
    <div
      ref="rootRef"
      class="fixed inset-0 z-[140] flex flex-col bg-bg text-fg"
      :style="rootStyle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <header class="app-safe-top flex shrink-0 items-center gap-2 px-3 py-2">
        <IconButton icon="arrow-left" variant="ghost" size="lg" label="Назад" @click="emit('close')" />
        <h2 class="flex-1 truncate text-center text-base font-medium text-fg">{{ title }}</h2>
        <div class="w-10" aria-hidden="true" />
      </header>

      <div class="flex min-h-0 flex-1 flex-col items-center px-6 pb-8">
        <div class="flex w-full max-w-sm flex-1 items-center justify-center py-4">
          <div class="relative rounded-card">
            <div
              v-if="coverSrc && !coverHasError"
              class="glow-pulse pointer-events-none absolute inset-0 -z-10"
              :style="glowStyle"
              aria-hidden="true"
            />
            <div
              class="track-cover aspect-square w-full max-w-[min(80vw,380px)] min-h-[380px] overflow-hidden rounded-card bg-bg-elevated"
              :class="[!coverSrc && coverHasError && 'track-cover_empty']"
            >
              <CoverImage
                :src="coverSrc"
                :alt="albumName"
                fallback-icon-class="h-1/2 w-1/2"
                @error="coverHasError = true"
                @load="coverHasError = false"
              />
            </div>
          </div>
        </div>

        <div class="relative w-full max-w-sm pb-6">
          <div class="min-w-0 px-12 text-center">
            <p class="text-xl font-medium text-fg break-words whitespace-pre-wrap">
              {{ currentTrack?.title ?? 'Ничего не играет' }}
            </p>
            <p class="mt-1 text-sm text-fg-muted break-words whitespace-pre-wrap">{{ currentTrack?.artist ?? '—' }}</p>
          </div>

          <div v-if="!isLive && !isLinear" class="absolute left-0 -top-1 flex items-start">
            <DislikeButton :track="currentTrack" size="lg" mode="skip" />
          </div>
          <div v-if="!isLive && !isLinear" class="absolute right-0 -top-1 flex items-start">
            <FavoriteButton :track="currentTrack" size="lg" />
          </div>
        </div>

        <div class="flex w-full max-w-sm items-center justify-between pb-8">
          <IconButton
            :icon="muted || volume === 0 ? 'volume-mute' : 'volume'"
            variant="ghost"
            :label="muted ? 'Включить звук' : 'Выключить звук'"
            @click="player.toggleMute()"
          />
          <div class="flex items-center gap-4">
            <IconButton
              v-if="!isLive && !isLinear"
              icon="shuffle"
              variant="ghost"
              :label="shuffle ? 'Не перемешивать' : 'Перемешать'"
              :class="shuffle ? 'text-active' : ''"
              @click="player.toggleShuffle()"
            />
            <IconButton
              v-if="!isLive && !isLinear"
              icon="repeat"
              variant="ghost"
              :label="`Повтор: ${repeatMode}`"
              :class="repeatMode !== 'off' ? 'text-active' : ''"
              @click="player.cycleRepeat()"
            />
            <IconButton icon="list" variant="ghost" :to="{ name: 'queue' }" label="Очередь" @click="emit('close')" />
          </div>
        </div>

        <div class="w-full max-w-sm pb-8">
          <div
            v-if="isLive"
            class="flex h-2 w-full items-center justify-center overflow-hidden rounded-full bg-active/20"
          >
            <span class="text-[10px] font-bold uppercase tracking-widest text-active">Live Stream</span>
          </div>
          <PlayerProgressBar
            v-else
            :current-time="currentTime"
            :duration="duration"
            size="lg"
            :show-time="true"
            @seek="onSeek"
          />
        </div>

        <div class="flex w-full max-w-sm items-center justify-center gap-6">
          <IconButton
            v-if="!isLive"
            icon="prev"
            variant="ghost"
            size="lg"
            label="Предыдущий трек"
            @click="player.prev()"
          />
          <button
            type="button"
            class="rounded-btn p-2 text-fg transition hover:bg-hover-bg"
            :aria-label="isPlaying ? 'Пауза' : 'Играть'"
            v-tooltip="isPlaying ? 'Пауза' : 'Играть'"
            @click="player.toggle()"
          >
            <Icon :name="isPlaying ? 'pause' : 'play'" w="w-8" h="h-8" :class="isPlaying ? '' : 'translate-x-[1px]'" />
          </button>
          <IconButton
            v-if="!isLive"
            icon="next"
            variant="ghost"
            size="lg"
            label="Следующий трек"
            @click="player.next()"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.glow-pulse {
  animation: glow-pulse 4s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(1.2) scale(1);
  }

  50% {
    opacity: 0.9;
    transform: scale(1.2) scale(1.1);
  }
}
</style>
