<!-- src/components/library/TrackMetadataModal.vue -->

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useLibraryStore } from '@/stores/library';
import AutocompleteInput from '@/components/ui/AutocompleteInput.vue';
import AlbumSelect from '@/components/library/AlbumSelect.vue';
import ModalLayout from '@/components/ui/ModalLayout.vue';
import FormField from '@/components/ui/FormField.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import MetadataCandidateDropdown from './metadata/MetadataCandidateDropdown.vue';
import { useFloatingDropdown } from './metadata/useFloatingDropdown';
import { useMetadataCandidates } from './metadata/useMetadataCandidates';
import { useMetadataForm } from './metadata/useMetadataForm';
import type { Track } from '@/types/track';

const props = defineProps<{
  track: Track;
}>();

const library = useLibraryStore();
const track = computed(() => props.track);

const dropdown = useFloatingDropdown();
const candidatesApi = useMetadataCandidates(track);
const { candidates: candidateList, isLoading: isLoadingCandidates, selectedIndex, select: selectCandidate } = candidatesApi;
const form = useMetadataForm({ track, library, candidates: candidatesApi });
const { artist, title, album, isDirty, allArtists, applyCandidate, save, cancel } = form;

function onPickCandidate(index: number): void {
  const candidate = selectCandidate(index);
  if (candidate) applyCandidate(candidate);
  dropdown.close();
}

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (isDirty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (dropdown.isOpen.value) {
      e.preventDefault();
      e.stopPropagation();
      dropdown.close();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    cancel();
  }
}

onMounted(() => {
  void candidatesApi.load();
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
      <MetadataCandidateDropdown
        :candidates="candidateList"
        :is-loading="isLoadingCandidates"
        :selected-index="selectedIndex"
        :is-open="dropdown.isOpen.value"
        :position="dropdown.position.value"
        :trigger-ref="dropdown.triggerRef"
        :dropdown-ref="dropdown.dropdownRef"
        @toggle="dropdown.toggle()"
        @select="onPickCandidate"
      />

      <FormField label="Название">
        <Input v-model="title" type="text" placeholder="Введите название..." data-testid="track-metadata-title-input" />
      </FormField>

      <FormField label="Артист">
        <AutocompleteInput v-model="artist" :suggestions="allArtists" placeholder="Введите артиста..." id="track-artist" />
      </FormField>

      <div class="flex flex-col gap-1">
        <label class="text-xs text-fg-muted">Альбом</label>
        <AlbumSelect v-model="album" :artist-filter="artist" />
      </div>
    </form>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" @click="cancel">Отмена</Button>
        <Button variant="primary" :disabled="!title.trim()" data-testid="track-metadata-save" @click="save"
          >Сохранить</Button
        >
      </div>
    </template>
  </ModalLayout>
</template>
