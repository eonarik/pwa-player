<!-- src/components/library/TrackMetadataModal.vue -->

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { useLibraryStore } from '@/stores/library';
import { metadataService } from '@/services/metadata/MetadataService';
import type { MetadataCandidate } from '@/types/metadata';
import { toastService } from '@/services/ui/ToastService';
import { modalService } from '@/services/ui/ModalService';
import AutocompleteInput from '@/components/ui/AutocompleteInput.vue';
import AlbumSelect from '@/components/library/AlbumSelect.vue';
import CoverImage from '@/components/ui/CoverImage.vue';
import ModalLayout from '@/components/ui/ModalLayout.vue';
import FormField from '@/components/ui/FormField.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { Track } from '@/types/track';

const props = defineProps<{
  track: Track;
}>();

const library = useLibraryStore();

const currentAlbum = computed(() => {
  if (!props.track.albumId) return null;
  return library.getAlbum(props.track.albumId);
});

const initialArtist = props.track.artist ?? '';
const initialTitle = props.track.title ?? '';
const initialAlbum = currentAlbum.value?.name ?? '';

const artist = ref(initialArtist);
const title = ref(initialTitle);
const album = ref(initialAlbum);

const candidates = ref<MetadataCandidate[]>([]);
const isLoadingCandidates = ref(false);
const selectedCandidateIndex = ref<number | null>(null);

async function loadCandidates() {
  if (!props.track.title?.trim()) return;
  isLoadingCandidates.value = true;
  try {
    const result = await metadataService.fetchCandidates(props.track.id);
    candidates.value = result;
  } catch (err) {
    console.warn('[metadata-modal] failed to load candidates', err);
  } finally {
    isLoadingCandidates.value = false;
  }
}

function selectCandidate(index: number) {
  const c = candidates.value[index];
  if (!c) return;
  artist.value = c.artist;
  title.value = c.title;
  album.value = c.album;
  selectedCandidateIndex.value = index;
  closeDropdown();
}

// --- Дропдаун «Найденные варианты» (Teleport + fixed) ---

const isDropdownOpen = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const dropdownStyle = ref<{ top: string; left: string; width: string }>({ top: '0px', left: '0px', width: '0px' });

function updateDropdownPosition() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  const width = rect.width;
  let left = rect.left;
  const maxLeft = window.innerWidth - width - 8;
  if (left > maxLeft) left = Math.max(8, maxLeft);

  dropdownStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${left}px`,
    width: `${width}px`,
  };
}

function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value;
  if (isDropdownOpen.value) {
    void nextTick(updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
  } else {
    window.removeEventListener('scroll', updateDropdownPosition, true);
    window.removeEventListener('resize', updateDropdownPosition);
  }
}

function closeDropdown() {
  if (!isDropdownOpen.value) return;
  isDropdownOpen.value = false;
  window.removeEventListener('scroll', updateDropdownPosition, true);
  window.removeEventListener('resize', updateDropdownPosition);
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  if (triggerRef.value && triggerRef.value.contains(target)) return;
  if (dropdownRef.value && dropdownRef.value.contains(target)) return;
  closeDropdown();
}

const selectedCandidateLabel = computed(() => {
  if (selectedCandidateIndex.value === null) return 'Выберите вариант...';
  const c = candidates.value[selectedCandidateIndex.value];
  return c ? `${c.artist} — ${c.title}` : 'Выберите вариант...';
});

function candidateAlbumLabel(c: MetadataCandidate): string {
  const albumName = (c.album || '').trim();
  return albumName ? `Альбом: ${albumName}` : 'Альбом: —';
}

function candidateSourceLabel(c: MetadataCandidate): string {
  const provider = (c.provider || '').trim() || 'unknown';
  const percent = Math.round((c.similarity ?? 0) * 100);
  return `Источник: ${provider} — ${percent}%`;
}

onMounted(() => {
  void loadCandidates();
  document.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
  window.removeEventListener('scroll', updateDropdownPosition, true);
  window.removeEventListener('resize', updateDropdownPosition);
});

const { tracks: allLibraryTracks } = storeToRefs(library);

const allArtists = computed(() => {
  return Array.from(
    new Set(
      Object.values(allLibraryTracks.value)
        .map((t) => t.artist?.trim())
        .filter((a): a is string => Boolean(a)),
    ),
  ).sort((a, b) => a.localeCompare(b, 'ru'));
});

const isDirty = computed(() => {
  return artist.value !== initialArtist || title.value !== initialTitle || album.value !== initialAlbum;
});

async function save() {
  const newArtist = artist.value.trim();
  const newTitle = title.value.trim();
  const newAlbum = album.value.trim();

  if (!newTitle) {
    toastService.error('Название трека не может быть пустым');
    return;
  }

  // Если выбран кандидат — применяем через applyCandidate
  // (сохраняет provider/extMetadata; провайдер сам решит, что делать).
  if (selectedCandidateIndex.value !== null) {
    const candidate = candidates.value[selectedCandidateIndex.value];
    if (candidate) {
      await metadataService.applyCandidate(props.track.id, {
        ...candidate,
        artist: newArtist,
        title: newTitle,
        album: newAlbum,
      });
      toastService.success('Метаданные обновлены');
      modalService.confirm();
      return;
    }
  }

  metadataService.updateManual(props.track.id, {
    artist: newArtist,
    title: newTitle,
    album: newAlbum,
    coverUrl: undefined,
  });

  toastService.success('Метаданные обновлены');
  modalService.confirm();
}

function cancel() {
  if (isDirty.value) {
    const confirmed = window.confirm('Есть несохраненные изменения. Закрыть без сохранения?');
    if (!confirmed) return;
  }
  modalService.cancel();
}

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (isDirty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isDropdownOpen.value) {
      e.preventDefault();
      e.stopPropagation();
      closeDropdown();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    cancel();
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('keydown', handleKeydown, true);
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  window.removeEventListener('keydown', handleKeydown, true);
});
</script>

<template>
  <ModalLayout title="Редактировать метаданные" max-width="md" :disable-backdrop-close="true" @close="cancel">
    <form class="flex flex-col gap-4" @submit.prevent="save">
      <!-- 1. Найденные варианты (первыми, чтобы было удобно) -->
      <div v-if="isLoadingCandidates" class="flex flex-col gap-1">
        <label class="text-xs text-fg-muted">Найденные варианты</label>
        <Spinner size="sm" text="Поиск вариантов в интернете…" />
      </div>

      <div v-else-if="candidates.length > 0" class="relative flex flex-col gap-1">
        <label class="text-xs text-fg-muted">Найденные варианты</label>
        <button
          ref="triggerRef"
          type="button"
          class="flex w-full items-center justify-between rounded-btn bg-card-bg px-3 py-2 text-sm text-fg transition hover:bg-hover-bg"
          @click="toggleDropdown"
        >
          <span class="truncate">{{ selectedCandidateLabel }}</span>
          <Icon
            name="chevron-down"
            w="w-4"
            h="h-4"
            class="ml-2 shrink-0 text-fg-muted transition"
            :class="isDropdownOpen ? 'rotate-180' : ''"
          />
        </button>

        <Teleport to="body">
          <div
            v-if="isDropdownOpen"
            ref="dropdownRef"
            class="fixed z-[300] max-h-60 overflow-y-auto rounded-btn border border-hover-bg bg-bg-elevated shadow-lg"
            :style="dropdownStyle"
          >
            <button
              v-for="(c, i) in candidates"
              :key="i"
              type="button"
              class="flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition hover:bg-hover-bg"
              :class="selectedCandidateIndex === i ? 'bg-active/10' : ''"
              @click="selectCandidate(i)"
            >
              <div class="h-10 w-10 shrink-0 overflow-hidden rounded-btn bg-card-bg">
                <CoverImage :src="c.coverUrl" :alt="c.title" fallback-icon-class="h-4 w-4" />
              </div>
              <div class="min-w-0 flex-1">
                <span
                  class="block truncate"
                  :class="selectedCandidateIndex === i ? 'text-active font-medium' : 'text-fg'"
                >
                  {{ c.artist }} — {{ c.title }}
                </span>
                <span class="block truncate text-xs text-fg-muted">{{ candidateAlbumLabel(c) }}</span>
                <span class="block truncate text-[10px] text-fg-subtle">{{ candidateSourceLabel(c) }}</span>
              </div>
            </button>
          </div>
        </Teleport>
      </div>

      <!-- 2. Ручное редактирование -->
      <FormField label="Название">
        <Input v-model="title" type="text" placeholder="Введите название..." />
      </FormField>

      <FormField label="Артист">
        <AutocompleteInput
          v-model="artist"
          :suggestions="allArtists"
          placeholder="Введите артиста..."
          id="track-artist"
        />
      </FormField>

      <div class="flex flex-col gap-1">
        <label class="text-xs text-fg-muted">Альбом</label>
        <AlbumSelect v-model="album" :artist-filter="artist" />
      </div>
    </form>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" @click="cancel">Отмена</Button>
        <Button variant="primary" :disabled="!title.trim()" @click="save">Сохранить</Button>
      </div>
    </template>
  </ModalLayout>
</template>
