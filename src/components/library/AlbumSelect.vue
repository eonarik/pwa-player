<!-- src/components/library/AlbumSelect.vue -->

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
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

const filteredAlbums = computed(() => {
  let result = allAlbums.value;

  const artistQuery = (props.artistFilter || '').trim().toLowerCase();
  if (artistQuery) {
    const matchingArtist = result.filter((a) => a.artist.trim().toLowerCase() === artistQuery);
    if (matchingArtist.length > 0) {
      result = matchingArtist;
    }
  }

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

function closeDropdown() {
  isOpen.value = false;
  window.removeEventListener('scroll', updatePosition, true);
  window.removeEventListener('resize', updatePosition);
}

function selectAlbum(album: Album | null) {
  emit('update:modelValue', album ? album.name : '');
  closeDropdown();
}

function onInputChange(e: Event) {
  const value = (e.target as HTMLInputElement).value;
  emit('update:modelValue', value);
  // Синхронизируем фильтр в дропдауне
  searchQuery.value = value;
}

function onDocumentClick(e: MouseEvent) {
  const target = e.target as Node;
  if (
    wrapperRef.value &&
    !wrapperRef.value.contains(target) &&
    dropdownRef.value &&
    !dropdownRef.value.contains(target)
  ) {
    closeDropdown();
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

// Если modelValue меняется извне (например, выбран кандидат из «Найденных вариантов»),
// синхронизируем searchQuery.
watch(
  () => props.modelValue,
  (v) => {
    if (!isOpen.value) searchQuery.value = v || '';
  },
);

// Фокус в input при открытии
const inputRef = ref<HTMLInputElement | null>(null);
watch(isOpen, async (v) => {
  if (v) {
    await nextTick();
    inputRef.value?.focus();
  }
});
</script>

<template>
  <div ref="wrapperRef" class="relative flex flex-col gap-2 w-full">
    <!-- 1. Ручной ввод -->
    <div class="flex items-center gap-2">
      <div class="h-10 w-10 shrink-0 overflow-hidden rounded-btn bg-bg">
        <CoverImage :src="displayCover" alt="Cover" fallback-icon-class="h-5 w-5" />
      </div>
      <input
        ref="inputRef"
        type="text"
        :value="modelValue"
        placeholder="Укажите альбом вручную или выберите из списка"
        class="min-w-0 flex-1 rounded-btn bg-card-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle transition focus:bg-hover-bg focus:outline-none"
        @input="onInputChange"
      />
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn bg-card-bg text-fg-muted transition hover:bg-hover-bg hover:text-fg"
        :aria-label="isOpen ? 'Скрыть список' : 'Выбрать из существующих'"
        v-tooltip="isOpen ? 'Скрыть список' : 'Выбрать из существующих'"
        @click="toggleDropdown"
      >
        <Icon name="chevron-down" w="w-4" h="h-4" class="transition" :class="isOpen ? 'rotate-180' : ''" />
      </button>
    </div>

    <!-- Подсказка, если есть совпадение с существующим (и это не точное совпадение) -->
    <p v-if="selectedAlbum && modelValue !== selectedAlbum.name" class="text-[10px] text-fg-subtle px-1">
      Существующий альбом: {{ selectedAlbum.name }}
    </p>

    <!-- 2. Дропдаун существующих -->
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
              placeholder="Поиск среди существующих..."
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

            <p v-if="filteredAlbums.length === 0" class="p-3 text-center text-xs text-fg-muted">
              Нет существующих альбомов{{ searchQuery ? ' по запросу' : '' }}
            </p>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
