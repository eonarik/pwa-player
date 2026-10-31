<!-- src/components/library/AlbumSelect.vue -->

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useLibraryStore } from '@/stores/library';
import Icon from '@/components/ui/Icon.vue';
import CoverImage from '@/components/ui/CoverImage.vue';
import type { Album } from '@/types/album';

const props = defineProps<{
  modelValue: string;
  artistFilter?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const library = useLibraryStore();

const isOpen = ref(false);
const searchQuery = ref('');
const wrapperRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const dropdownStyle = ref({ top: '0px', left: '0px', width: '0px' });

const allAlbums = computed(() => {
  return Object.values(library.albums)
    .filter((a) => a.name.trim().length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
});

// Фильтрация по артисту и поисковому запросу
const filteredAlbums = computed(() => {
  let result = allAlbums.value;

  // 1. Фильтр по артисту (если задан)
  const artistQuery = (props.artistFilter || '').trim().toLowerCase();
  if (artistQuery) {
    // Сначала показываем альбомы этого артиста, потом остальные
    const matchingArtist = result.filter((a) => a.artist.trim().toLowerCase() === artistQuery);
    const others = result.filter((a) => a.artist.trim().toLowerCase() !== artistQuery);

    // Если есть альбомы этого артиста, показываем только их (или их + остальные)
    if (matchingArtist.length > 0) {
      result = matchingArtist;
    } else {
      result = others; // если у артиста нет альбомов, показываем все (на случай если артист в альбоме написан иначе)
    }
  }

  // 2. Поиск по названию
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    result = result.filter((a) => a.name.toLowerCase().includes(q));
  }

  return result;
});

const selectedAlbum = computed(() => {
  if (!props.modelValue) return null;
  return allAlbums.value.find((a) => a.name === props.modelValue) || null;
});

const displayCover = computed(() => selectedAlbum.value?.coverUrl ?? undefined);

function updatePosition() {
  if (!wrapperRef.value) return;
  const rect = wrapperRef.value.getBoundingClientRect();
  dropdownStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
  };
}

function toggleDropdown() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    searchQuery.value = '';
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
  } else {
    window.removeEventListener('scroll', updatePosition, true);
    window.removeEventListener('resize', updatePosition);
  }
}

function selectAlbum(album: Album | null) {
  if (album) {
    emit('update:modelValue', album.name);
  } else {
    emit('update:modelValue', '');
  }
  isOpen.value = false;
}

function onDocumentClick(e: MouseEvent) {
  const target = e.target as Node;
  if (
    wrapperRef.value &&
    !wrapperRef.value.contains(target) &&
    dropdownRef.value &&
    !dropdownRef.value.contains(target)
  ) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentClick);
  window.removeEventListener('scroll', updatePosition, true);
  window.removeEventListener('resize', updatePosition);
});
</script>

<template>
  <div ref="wrapperRef" class="relative w-full">
    <!-- Выбранный альбом (кнопка) -->
    <button
      type="button"
      class="flex w-full items-center gap-3 rounded-btn bg-card-bg p-2 text-left transition hover:bg-hover-bg focus:outline-none"
      @click="toggleDropdown"
    >
      <div class="h-10 w-10 shrink-0 overflow-hidden rounded-btn bg-bg">
        <CoverImage :src="displayCover" alt="Cover" fallback-icon-class="h-5 w-5" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm text-fg" :class="!modelValue ? 'text-fg-muted' : ''">
          {{ modelValue || 'Без альбома' }}
        </p>
        <p v-if="selectedAlbum?.artist" class="truncate text-xs text-fg-muted">{{ selectedAlbum.artist }}</p>
      </div>
      <Icon
        name="chevron-down"
        w="w-4"
        h="h-4"
        class="shrink-0 text-fg-muted transition"
        :class="isOpen ? 'rotate-180' : ''"
      />
    </button>

    <!-- Выпадающий список -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div
          v-if="isOpen"
          ref="dropdownRef"
          class="fixed z-[200] flex max-h-64 flex-col overflow-hidden rounded-btn bg-bg-elevated shadow-lg border border-hover-bg"
          :style="dropdownStyle"
        >
          <!-- Поиск -->
          <div class="border-b border-hover-bg p-2">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Поиск альбома..."
              class="w-full rounded-btn bg-card-bg px-2 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
            />
          </div>

          <!-- Список -->
          <div class="flex-1 overflow-y-auto p-1">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-btn p-2 text-left transition hover:bg-hover-bg"
              @click="selectAlbum(null)"
            >
              <div
                class="h-10 w-10 shrink-0 rounded-btn bg-bg border border-hover-bg flex items-center justify-center text-fg-muted"
              >
                <Icon name="x" w="w-4" h="h-4" />
              </div>
              <p class="text-sm text-fg">Без альбома</p>
            </button>

            <button
              v-for="album in filteredAlbums"
              :key="album.id"
              type="button"
              class="flex w-full items-center gap-3 rounded-btn p-2 text-left transition hover:bg-hover-bg"
              :class="album.name === modelValue ? 'bg-active/10' : ''"
              @click="selectAlbum(album)"
            >
              <div class="h-10 w-10 shrink-0 overflow-hidden rounded-btn bg-bg">
                <CoverImage :src="album.coverUrl" :alt="album.name" fallback-icon-class="h-5 w-5" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm" :class="album.name === modelValue ? 'text-active' : 'text-fg'">
                  {{ album.name }}
                </p>
                <p class="truncate text-xs text-fg-muted">{{ album.artist }}</p>
              </div>
            </button>

            <p v-if="filteredAlbums.length === 0" class="p-3 text-center text-xs text-fg-muted">Альбомы не найдены</p>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
