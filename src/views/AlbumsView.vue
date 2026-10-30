<!-- src/views/AlbumsView.vue -->

<!-- AlbumsView.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { pluralize } from '@/utils/pluralize';
import { compareStrings } from '@/utils/sort';
import PageHeader from '@/components/ui/PageHeader.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Icon from '@/components/ui/Icon.vue';

const library = useLibraryStore();
const player = usePlayerStore();

const allAlbums = computed(() => {
  return Object.values(library.albums).sort((a, b) => compareStrings(a.name, b.name));
});

function playAlbum(albumId: string) {
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
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PageHeader
      title="Альбомы"
      :subtitle="pluralize(allAlbums.length, ['альбом', 'альбома', 'альбомов'])"
      max-width="lg"
    />

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-5xl py-4">
        <EmptyState v-if="allAlbums.length === 0" title="Альбомов пока нет">
          <template #icon>
            <Icon name="playlist" w="w-10" h="h-10" />
          </template>
        </EmptyState>

        <div
          v-else
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-5 lg:gap-6 px-4"
        >
          <div v-for="album in allAlbums" :key="album.id" class="group relative">
            <div class="relative aspect-square overflow-hidden bg-card-bg">
              <img
                v-if="album.coverUrl"
                :src="album.coverUrl"
                :alt="album.name"
                class="h-full w-full object-cover transition group-hover:scale-105"
                loading="lazy"
              />
              <div v-else class="flex h-full w-full items-center justify-center">
                <Icon name="playlist" w="w-12" h="h-12" class="text-fg-subtle" />
              </div>

              <button
                type="button"
                class="absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-bg opacity-100 shadow-lg transition hover:scale-105 md:opacity-0 md:group-hover:opacity-100"
                :aria-label="`Играть альбом ${album.name}`"
                @click.prevent.stop="playAlbum(album.id)"
              >
                <Icon name="play" w="w-5" h="h-5" class="translate-x-[1px]" />
              </button>
            </div>

            <div class="mt-2 min-w-0">
              <RouterLink
                :to="{
                  name: 'album',
                  params: { artistName: album.artist, album: album.name.toLowerCase().replace(/\s+/g, '-') },
                }"
                class="line-clamp-2 text-sm font-medium text-fg transition hover:text-active"
                :title="album.name"
              >
                {{ album.name }}
              </RouterLink>
              <p class="line-clamp-2 text-xs text-fg-muted" :title="album.artist">
                {{ album.artist }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
