<!-- src/views/ArtistsView.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useLibraryStore } from '@/stores/library';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { useCollectionView } from '@/composables/useCollectionView';
import { pluralize } from '@/utils/pluralize';
import { compareStrings } from '@/utils/sort';
import { fuzzyMatch } from '@/utils/fuzzyMatch';
import { layoutVariants } from '@/utils/layout';
import PageHeader from '@/components/ui/PageHeader.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Icon from '@/components/ui/Icon.vue';
import CoverImage from '@/components/ui/CoverImage.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import SearchInput from '@/components/ui/SearchInput.vue';
import VirtualGrid from '@/components/ui/VirtualGrid.vue';
import AlphabetIndex from '@/components/ui/AlphabetIndex.vue';
import ViewToggle from '@/components/ui/ViewToggle.vue';
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

const { viewMode, setItems, sections, letters, onLetterSelect } = useCollectionView<ArtistGroup>({
  storageKey: 'artists:viewMode',
  getGroupKey: (artist) => artist.name.charAt(0).toUpperCase(),
  sortItems: (a, b) => compareStrings(a.name, b.name),
});

watch(filteredArtists, (val) => setItems(val), { immediate: true });

function openArtist(artist: ArtistGroup) {
  router.push({ name: 'artist', params: { artistName: artist.name } });
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden relative">
    <PageHeader
      title="Исполнители"
      :subtitle="pluralize(filteredArtists.length, ['исполнитель', 'исполнителя', 'исполнителей'])"
    >
      <div class="flex items-center gap-3">
        <SearchInput v-model="query" always-open placeholder="Поиск..." class="w-48" />
        <div class="bg-card-bg px-3 py-1.5 rounded-btn shrink-0">
          <Checkbox v-model="onlyWithAlbums" label="Только с альбомами" />
        </div>
        <ViewToggle v-model="viewMode" />
      </div>
    </PageHeader>

    <div class="flex-1 relative overflow-hidden">
      <EmptyState v-if="filteredArtists.length === 0" :title="query ? 'Ничего не найдено' : 'Исполнителей не найдено'">
        <template #icon>
          <Icon :name="query ? 'search' : 'artist'" w="w-10" h="h-10" />
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
        <template #item="{ item: artist, mode }">
          <div
            class="group cursor-pointer rounded-btn transition"
            :class="[
              mode === 'list'
                ? 'flex flex-row items-center gap-3 p-1 hover:bg-hover-bg'
                : 'flex flex-col items-center hover:opacity-90',
            ]"
            @click="openArtist(artist)"
          >
            <div
              class="relative flex shrink-0 items-center justify-center overflow-hidden bg-card-bg"
              :class="[
                mode === 'list' ? 'h-9 w-9 rounded-full' : 'w-full aspect-square rounded-full',
                !artist.coverUrl && 'track-cover_empty',
              ]"
            >
              <CoverImage
                :src="artist.coverUrl"
                :alt="artist.name"
                fallback-icon-class="w-8 h-8"
                class="transition group-hover:scale-105"
              />
            </div>

            <div class="min-w-0 w-full" :class="mode === 'list' ? 'flex-1 text-left' : 'mt-2 text-center'">
              <p class="text-sm font-medium leading-[1.2] text-fg break-words" :title="artist.name">
                {{ artist.name }}
              </p>
              <p class="text-xs leading-[1.2] text-fg-muted mt-0.5">
                {{ pluralize(artist.tracks.length, ['трек', 'трека', 'треков']) }}
                <template v-if="artist.albumsCount > 0">
                  · {{ pluralize(artist.albumsCount, ['альбом', 'альбома', 'альбомов']) }}
                </template>
              </p>
            </div>
          </div>
        </template>
      </VirtualGrid>

      <AlphabetIndex v-if="!query" :letters="letters" @select="onLetterSelect" />
    </div>
  </div>
</template>
