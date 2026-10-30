<!-- src/views/ArtistView.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { filterTracksByArtist, NO_ALBUM_LABEL } from '@/utils/artists';
import { pluralize } from '@/utils/pluralize';
import ShowSourceCheckbox from '@/components/ui/ShowSourceCheckbox.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Icon from '@/components/ui/Icon.vue';
import type { Track } from '@/types/track';

const route = useRoute();
const library = useLibraryStore();
const player = usePlayerStore();

const artistName = computed(() => String(route.params.artistName ?? ''));

const artistTracks = computed<Track[]>(() => filterTracksByArtist(Object.values(library.tracks), artistName.value));

interface AlbumGroupUI {
  albumId: string | null;
  name: string;
  slug: string;
  tracks: Track[];
  coverUrl: string | undefined;
}

const albums = computed<AlbumGroupUI[]>(() => {
  const map = new Map<string, Track[]>();
  for (const track of artistTracks.value) {
    const key = track.albumId ?? '';
    const list = map.get(key);
    if (list) list.push(track);
    else map.set(key, [track]);
  }

  const groups: AlbumGroupUI[] = [];
  for (const [albumId, list] of map) {
    const sorted = [...list].sort((a, b) => {
      const an = a.trackNumber ?? Number.MAX_SAFE_INTEGER;
      const bn = b.trackNumber ?? Number.MAX_SAFE_INTEGER;
      if (an !== bn) return an - bn;
      return a.title.localeCompare(b.title, 'ru');
    });

    const album = albumId ? library.getAlbum(albumId as never) : null;
    groups.push({
      albumId: albumId || null,
      name: album?.name ?? NO_ALBUM_LABEL,
      slug: albumId || 'no-album',
      tracks: sorted,
      coverUrl: album?.coverUrl ?? undefined,
    });
  }

  groups.sort((a, b) => {
    if (!a.albumId) return 1;
    if (!b.albumId) return -1;
    return a.name.localeCompare(b.name, 'ru');
  });

  return groups;
});

const tracksCount = computed(() => artistTracks.value.length);
const albumsPart = computed(() => pluralize(albums.value.length, ['альбом', 'альбома', 'альбомов']));
const tracksPart = computed(() => pluralize(tracksCount.value, ['трек', 'трека', 'треков']));

function playAll() {
  if (artistTracks.value.length === 0) return;
  player.playAll(albums.value.flatMap((a) => a.tracks));
}

function playAlbum(group: { tracks: Track[] }) {
  if (group.tracks.length === 0) return;
  player.setQueue(group.tracks, 0);
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PageHeader :title="artistName" :subtitle="`${albumsPart} · ${tracksPart}`" max-width="lg">
      <ShowSourceCheckbox />
      <Button v-if="tracksCount > 0" variant="primary" size="sm" @click="playAll">Играть всё</Button>
    </PageHeader>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-5xl">
        <EmptyState v-if="albums.length === 0" title="У этого артиста нет треков">
          <template #icon>
            <Icon name="playlist" w="w-10" h="h-10" />
          </template>
        </EmptyState>

        <div
          v-else
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-5 lg:gap-6 p-4"
        >
          <div v-for="group in albums" :key="group.slug" class="group relative">
            <RouterLink :to="{ name: 'album', params: { artistName, album: group.slug } }" class="block">
              <div class="relative aspect-square overflow-hidden bg-card-bg">
                <img
                  v-if="group.coverUrl"
                  :src="group.coverUrl"
                  :alt="group.name"
                  class="h-full w-full object-cover transition group-hover:scale-105"
                  loading="lazy"
                />
                <div v-else class="flex h-full w-full items-center justify-center">
                  <Icon name="playlist" w="w-12" h="h-12" class="text-fg-subtle" />
                </div>
                <button
                  type="button"
                  class="absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-bg opacity-100 shadow-lg transition hover:scale-105 md:opacity-0 md:group-hover:opacity-100"
                  :aria-label="`Играть альбом ${group.name}`"
                  @click.prevent.stop="playAlbum(group)"
                >
                  <Icon name="play" w="w-5" h="h-5" class="translate-x-[1px]" />
                </button>
              </div>
            </RouterLink>

            <div class="mt-2 min-w-0">
              <RouterLink
                :to="{ name: 'album', params: { artistName, album: group.slug } }"
                class="block truncate text-sm font-medium text-fg transition hover:text-active"
              >
                {{ group.name }}
              </RouterLink>
              <p class="truncate text-xs text-fg-muted">
                {{ pluralize(group.tracks.length, ['трек', 'трека', 'треков']) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
