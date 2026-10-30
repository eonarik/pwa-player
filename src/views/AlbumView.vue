<!-- src/views/AlbumView.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useLibraryStore } from '@/stores/library';
import { NO_ALBUM_SLUG, NO_ALBUM_LABEL } from '@/utils/artists';
import { pluralize } from '@/utils/pluralize';
import { compareStrings } from '@/utils/sort';
import TrackListPage from '@/components/library/TrackListPage.vue';
import ShowSourceCheckbox from '@/components/ui/ShowSourceCheckbox.vue';
import type { Track } from '@/types/track';
import EmptyState from '@/components/ui/EmptyState.vue';
import Icon from '@/components/ui/Icon.vue';

const route = useRoute();
const library = useLibraryStore();

const artistName = computed(() => String(route.params.artistName ?? ''));
const albumSlug = computed(() => String(route.params.album ?? ''));
const isNoAlbum = computed(() => albumSlug.value === NO_ALBUM_SLUG);

const currentAlbum = computed(() => {
  if (isNoAlbum.value) return null;
  return (
    Object.values(library.albums).find(
      (a) => a.artist === artistName.value && a.name.toLowerCase().replace(/\s+/g, '-') === albumSlug.value,
    ) || null
  );
});

const tracks = computed<Track[]>(() => {
  if (isNoAlbum.value) {
    return Object.values(library.tracks)
      .filter((t) => (t.artist || '').toLowerCase().trim() === artistName.value.toLowerCase().trim())
      .filter((t) => t.albumId === null)
      .sort((a, b) => compareStrings(a.title, b.title));
  }

  if (!currentAlbum.value) return [];
  const ids = library.tracksByAlbumId[currentAlbum.value.id] ?? [];
  return ids
    .map((id) => library.getTrack(id))
    .filter((t): t is Track => Boolean(t))
    .sort((a, b) => {
      const an = a.trackNumber ?? Number.MAX_SAFE_INTEGER;
      const bn = b.trackNumber ?? Number.MAX_SAFE_INTEGER;
      if (an !== bn) return an - bn;
      return compareStrings(a.title, b.title);
    });
});

const displayAlbumName = computed(() => {
  return isNoAlbum.value ? NO_ALBUM_LABEL : (currentAlbum.value?.name ?? 'Альбом');
});

const subtitle = computed(() => {
  if (tracks.value.length === 0) return '';
  return pluralize(tracks.value.length, ['трек', 'трека', 'треков']);
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <TrackListPage
      :title="displayAlbumName"
      :subtitle="subtitle"
      :tracks="tracks"
      :show-search="true"
      :show-filter="true"
      :show-play-all="true"
      :show-batch-add="true"
    >
      <template #header-actions>
        <div class="flex items-center gap-3">
          <RouterLink
            :to="{ name: 'artist', params: { artistName } }"
            class="flex items-center gap-1 truncate rounded-btn px-2 py-1 text-sm text-fg-muted transition hover:bg-hover-bg hover:text-fg"
          >
            <Icon name="arrow-left" w="w-4" h="w-4" />
            {{ artistName }}
          </RouterLink>
          <ShowSourceCheckbox />
        </div>
      </template>

      <template #empty>
        <EmptyState v-if="!currentAlbum && !isNoAlbum" title="Альбом не найден">
          <template #icon>
            <Icon name="album" w="w-10" h="h-10" />
          </template>
        </EmptyState>
        <EmptyState v-else title="В этом альбоме нет треков">
          <template #icon>
            <Icon name="music" w="w-10" h="h-10" />
          </template>
        </EmptyState>
      </template>
    </TrackListPage>
  </div>
</template>
