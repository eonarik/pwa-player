<!-- src/views/ArtistsView.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLibraryStore } from '@/stores/library';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { pluralize } from '@/utils/pluralize';
import { compareStrings } from '@/utils/sort';
import { fuzzyMatch } from '@/utils/fuzzyMatch';
import { layoutVariants } from '@/utils/layout';
import PageHeader from '@/components/ui/PageHeader.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ListContainer from '@/components/ui/ListContainer.vue';
import ListRow from '@/components/ui/ListRow.vue';
import Icon from '@/components/ui/Icon.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import SearchInput from '@/components/ui/SearchInput.vue';
import type { Track } from '@/types/track';

const router = useRouter();
const library = useLibraryStore();
const uiSettings = useUiSettingsStore();

const onlyWithAlbums = ref(false);
const query = ref('');

interface ArtistGroup {
  key: string;
  name: string;
  tracks: Track[];
  albumsCount: number;
  coverUrl: string | null | undefined;
}

function normalizeArtistName(name: string): string {
  const withoutFeat = name
    .replace(/\s+(feat|ft)\.?\s+.*/i, '')
    .replace(/\s*&\s*.*/i, '')
    .trim();
  return withoutFeat
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]/gi, '')
    .trim();
}

const allArtists = computed<ArtistGroup[]>(() => {
  const map = new Map<string, { displayNames: Map<string, number>; tracks: Track[] }>();

  for (const track of Object.values(library.tracks)) {
    const rawArtist = track.artist?.trim();
    if (!rawArtist) continue;
    const normalizedKey = normalizeArtistName(rawArtist);
    if (!normalizedKey) continue;
    let entry = map.get(normalizedKey);
    if (!entry) {
      entry = { displayNames: new Map(), tracks: [] };
      map.set(normalizedKey, entry);
    }
    const currentCount = entry.displayNames.get(rawArtist) ?? 0;
    entry.displayNames.set(rawArtist, currentCount + 1);
    entry.tracks.push(track);
  }

  const result: ArtistGroup[] = [];
  for (const [key, { displayNames, tracks }] of map) {
    let bestName = '';
    let maxCount = 0;
    for (const [name, count] of displayNames) {
      if (count > maxCount) {
        bestName = name;
        maxCount = count;
      }
    }
    const albums = new Set(
      tracks
        .map((t) => (t.albumId ? library.getAlbum(t.albumId)?.name?.toLowerCase() : undefined))
        .filter((a): a is string => Boolean(a)),
    );
    const coverUrl =
      tracks.map((t) => (t.albumId ? library.getAlbum(t.albumId)?.coverUrl : undefined)).find((c) => Boolean(c)) ??
      undefined;

    result.push({ key, name: bestName, tracks, albumsCount: albums.size, coverUrl });
  }

  return result.sort((a, b) => compareStrings(a.name, b.name));
});

const filteredArtists = computed(() => {
  let list = allArtists.value;
  if (onlyWithAlbums.value) list = list.filter((a) => a.albumsCount > 0);

  const q = query.value.trim().toLowerCase();
  if (q) {
    const tokens = q.split(/\s+/).filter(Boolean);
    const threshold = uiSettings.searchThreshold;
    list = list.filter((a) => {
      const variants = layoutVariants(a.name);
      return tokens.some((token) => {
        if (token.length < 3) return false;
        return variants.some((variant) => {
          if (variant.includes(token)) return true;
          const words = variant.split(/\s+/);
          return words.some((word) => {
            if (word.length >= 4 && fuzzyMatch(token, word) >= threshold) return true;
            return false;
          });
        });
      });
    });
  }
  return list;
});

function openArtist(artist: ArtistGroup) {
  router.push({ name: 'artist', params: { artistName: artist.name } });
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PageHeader
      title="Исполнители"
      :subtitle="pluralize(filteredArtists.length, ['исполнитель', 'исполнителя', 'исполнителей'])"
    >
      <div class="flex items-center gap-3">
        <SearchInput v-model="query" always-open placeholder="Поиск..." class="w-48" />
        <div class="bg-card-bg px-3 py-1.5 rounded-btn shrink-0">
          <Checkbox v-model="onlyWithAlbums" label="Только с альбомами" />
        </div>
      </div>
    </PageHeader>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl p-2">
        <EmptyState
          v-if="filteredArtists.length === 0"
          :title="query ? 'Ничего не найдено' : 'Исполнителей не найдено'"
        >
          <template #icon>
            <Icon :name="query ? 'search' : 'artist'" w="w-10" h="h-10" />
          </template>
        </EmptyState>

        <ListContainer v-else max-width="lg">
          <ListRow v-for="artist in filteredArtists" :key="artist.key" @click="openArtist(artist)">
            <template #leading>
              <div
                class="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card-bg"
              >
                <img
                  v-if="artist.coverUrl"
                  :src="artist.coverUrl"
                  :alt="artist.name"
                  class="h-full w-full object-cover"
                  loading="lazy"
                />
                <Icon v-else name="artist" w="w-5" h="h-5" class="text-fg-muted" />
              </div>
            </template>
            <template #title>
              <p class="truncate text-sm font-medium">{{ artist.name }}</p>
            </template>
            <template #subtitle>
              <p class="truncate text-xs text-fg-muted">
                {{ pluralize(artist.tracks.length, ['трек', 'трека', 'треков']) }}
                <template v-if="artist.albumsCount > 0">
                  · {{ pluralize(artist.albumsCount, ['альбом', 'альбома', 'альбомов']) }}</template
                >
              </p>
            </template>
            <template #trailing>
              <div class="shrink-0 text-fg-subtle transition hover:text-fg" aria-hidden="true">
                <Icon name="chevron-right" w="w-4" h="h-4" />
              </div>
            </template>
          </ListRow>
        </ListContainer>
      </div>
    </div>
  </div>
</template>
