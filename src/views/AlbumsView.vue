<!-- src/views/AlbumsView.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useCollectionView } from '@/composables/useCollectionView';
import { pluralize } from '@/utils/pluralize';
import { compareStrings } from '@/utils/sort';
import { toastService } from '@/services/ui/ToastService';
import PageHeader from '@/components/ui/PageHeader.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Icon from '@/components/ui/Icon.vue';
import CoverImage from '@/components/ui/CoverImage.vue';
import VirtualGrid from '@/components/ui/VirtualGrid.vue';
import AlphabetIndex from '@/components/ui/AlphabetIndex.vue';
import ViewToggle from '@/components/ui/ViewToggle.vue';
import SearchInput from '@/components/ui/SearchInput.vue';
import type { Album } from '@/types/album';

const router = useRouter();
const library = useLibraryStore();
const player = usePlayerStore();

const query = computed({
  get: () => searchQuery.value,
  set: (v) => (searchQuery.value = v),
});
const searchQuery = ref('');

const allAlbums = computed(() => {
  return Object.values(library.albums)
    .filter(
      (a) =>
        !searchQuery.value ||
        a.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        a.artist.toLowerCase().includes(searchQuery.value.toLowerCase()),
    )
    .sort((a, b) => compareStrings(a.name, b.name));
});

const { viewMode, gridRef, setItems, sections, letters, onLetterSelect } = useCollectionView<Album>({
  storageKey: 'albums:viewMode',
  getGroupKey: (album) => {
    const artist = album.artist || 'Неизвестный исполнитель';
    return artist.charAt(0).toUpperCase();
  },
  sortItems: (a, b) => compareStrings(a.name, b.name),
});

watch(allAlbums, (val) => setItems(val), { immediate: true });

function playAlbum(albumId: string, e: Event) {
  e.stopPropagation();
  const ids = library.tracksByAlbumId[albumId as never] ?? [];
  const tracks = ids
    .map((id) => library.getTrack(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .sort((a, b) => {
      const an = a.trackNumber ?? Number.MAX_SAFE_INTEGER;
      const bn = b.trackNumber ?? Number.MAX_SAFE_INTEGER;
      if (an !== bn) return an - bn;
      return compareStrings(a.title, b.title);
    });
  if (tracks.length === 0) return;
  player.setQueue(tracks, 0);
}

function isAlbumEmpty(album: Album): boolean {
  const ids = library.tracksByAlbumId[album.id];
  return !ids || ids.length === 0;
}

function deleteAlbum(album: Album, e: Event) {
  e.stopPropagation();
  if (!isAlbumEmpty(album)) return;

  const confirmed = window.confirm(`Удалить пустой альбом «${album.name}»?`);
  if (!confirmed) return;

  const writer = createLibraryWriter();
  writer.removeAlbum(album.id);
  toastService.success(`Альбом «${album.name}» удалён`);
}

function goToAlbum(album: Album) {
  router.push({ name: 'album', params: { artistName: album.artist, album: album.id } });
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden relative">
    <PageHeader
      title="Альбомы"
      :subtitle="pluralize(allAlbums.length, ['альбом', 'альбома', 'альбомов'])"
      max-width="md"
    >
      <div class="flex items-center gap-3">
        <SearchInput v-model="query" always-open placeholder="Поиск..." class="w-48" />
        <ViewToggle v-model="viewMode" />
      </div>
    </PageHeader>

    <div class="flex-1 relative overflow-hidden">
      <EmptyState v-if="allAlbums.length === 0" title="Альбомов пока нет">
        <template #icon>
          <Icon name="playlist" w="w-10" h="h-10" />
        </template>
      </EmptyState>

      <VirtualGrid
        v-else
        ref="gridRef"
        :sections="sections"
        :mode="viewMode"
        :min-column-width="150"
        :aspect-ratio="1.2"
        :forced-columns="4"
        :section-gap="16"
        max-width="md"
        class="h-full"
      >
        <template #item="{ item: album, mode }">
          <div
            class="group relative flex cursor-pointer rounded-btn transition"
            :class="[
              mode === 'list' ? 'flex-row items-center gap-3 p-1 hover:bg-hover-bg' : 'flex-col hover:opacity-90',
            ]"
            @click="goToAlbum(album)"
          >
            <div
              class="relative overflow-hidden bg-card-bg"
              :class="mode === 'list' ? 'h-9 w-9 shrink-0 rounded-btn' : 'aspect-square w-full rounded-card'"
            >
              <CoverImage
                :src="album.coverUrl"
                :alt="album.name"
                fallback-icon-class="w-8 h-8"
                class="transition group-hover:scale-105"
              />
              <!-- Play/Delete buttons (только в grid) -->
              <button
                type="button"
                class="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-bg opacity-100 shadow-lg transition hover:scale-105 md:opacity-0 md:group-hover:opacity-100"
                :class="mode === 'list' ? 'hidden' : ''"
                @click="(e) => playAlbum(album.id, e)"
              >
                <Icon name="play" w="w-4" h="w-4" class="translate-x-[1px]" />
              </button>
              <button
                v-if="isAlbumEmpty(album)"
                type="button"
                class="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-bg/80 text-red-400 opacity-100 shadow-lg transition hover:bg-red-500/20 md:opacity-0 md:group-hover:opacity-100"
                :class="mode === 'list' ? 'hidden' : ''"
                @click="(e) => deleteAlbum(album, e)"
              >
                <Icon name="trash" w="w-4" h="h-4" />
              </button>
            </div>

            <div class="min-w-0 w-full" :class="mode === 'list' ? 'flex-1 text-left' : 'mt-2 text-left'">
              <p
                class="text-sm font-medium leading-[1.2] text-fg break-words transition hover:text-active"
                :title="album.name"
              >
                {{ album.name }}
              </p>
              <p class="text-xs leading-[1.2] text-fg-muted break-words mt-0.5" :title="album.artist">
                {{ album.artist }}
              </p>
            </div>
          </div>
        </template>
      </VirtualGrid>

      <AlphabetIndex v-if="allAlbums.length > 0" :letters="letters" @select="onLetterSelect" />
    </div>
  </div>
</template>
