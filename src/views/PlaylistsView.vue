<!-- src/views/PlaylistsView.vue -->

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { usePlaylistsStore } from '@/stores/playlists';
import { FAVORITES_PLAYLIST_ID } from '@/types/collection';
import type { Playlist } from '@/types/collection';
import { pluralize } from '@/utils/pluralize';
import PageHeader from '@/components/ui/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Icon from '@/components/ui/Icon.vue';
import IconHeart from '@/components/icons/IconHeart.vue';
import ListContainer from '@/components/ui/ListContainer.vue';
import ImportPlaylistModal from '@/components/playlists/ImportPlaylistModal.vue';

const router = useRouter();
const playlists = usePlaylistsStore();
const { sortedPlaylists } = storeToRefs(playlists);

const isCreating = ref(false);
const newName = ref('');
const isImportModalOpen = ref(false);

function openPlaylist(playlist: Playlist) {
  router.push({ name: 'playlist', params: { id: playlist.id } });
}

function startCreate() {
  isCreating.value = true;
  newName.value = '';
}

function cancelCreate() {
  isCreating.value = false;
  newName.value = '';
}

function confirmCreate() {
  const name = newName.value.trim();
  if (!name) return;
  const id = playlists.createPlaylist(name);
  isCreating.value = false;
  newName.value = '';
  router.push({ name: 'playlist', params: { id } });
}

function deletePlaylist(playlist: Playlist) {
  if (playlist.id === FAVORITES_PLAYLIST_ID) return;
  const confirmed = window.confirm(`Удалить плейлист «${playlist.name}»?`);
  if (!confirmed) return;
  playlists.deletePlaylist(playlist.id);
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function onImported(payload: { playlistId: string; stats: unknown }) {
  router.push({ name: 'playlist', params: { id: payload.playlistId } });
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PageHeader title="Плейлисты">
      <Button v-if="!isCreating" variant="secondary" size="sm" @click="isImportModalOpen = true">
        Импортировать
      </Button>
      <Button v-if="!isCreating" variant="primary" size="sm" @click="startCreate">Создать плейлист</Button>
    </PageHeader>

    <div v-if="isCreating" class="shrink-0 px-4 py-3">
      <div class="mx-auto w-full max-w-3xl">
        <form class="flex items-center gap-2" @submit.prevent="confirmCreate">
          <Input v-model="newName" placeholder="Название плейлиста" autofocus class="flex-1" />
          <Button type="submit" variant="primary" size="sm" :disabled="!newName.trim()">Создать</Button>
          <Button variant="secondary" size="sm" @click="cancelCreate">Отмена</Button>
        </form>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl p-2">
        <EmptyState v-if="sortedPlaylists.length === 0" title="Плейлистов пока нет">
          <template #icon>
            <Icon name="playlist" w="w-10" h="h-10" />
          </template>
        </EmptyState>

        <ListContainer v-else max-width="lg">
          <button
            v-for="playlist in sortedPlaylists"
            :key="playlist.id"
            type="button"
            class="group flex items-center gap-3 px-3 py-2 text-left text-fg transition hover:bg-hover-bg"
            @click="openPlaylist(playlist)"
            :data-testid="`playlist-row-${playlist.id}`"
          >
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-card-bg">
              <IconHeart v-if="playlist.id === FAVORITES_PLAYLIST_ID" :filled="true" class="icon h-5 w-5 text-active" />
              <Icon v-else name="playlist" w="w-5" h="h-5" class="text-fg-muted" />
            </div>

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ playlist.name }}</p>
              <p class="truncate text-xs text-fg-muted">
                {{ pluralize(playlist.trackIds.length, ['трек', 'трека', 'треков']) }}
                <span v-if="playlist.id !== FAVORITES_PLAYLIST_ID"> · {{ formatDate(playlist.updatedAt) }} </span>
              </p>
            </div>

            <div
              v-if="playlist.id !== FAVORITES_PLAYLIST_ID"
              class="rounded-btn p-1.5 text-fg-subtle opacity-0 transition hover:bg-hover-bg hover:text-red-400 group-hover:opacity-100"
              aria-label="Удалить"
              @click.stop="deletePlaylist(playlist)"
            >
              <Icon name="trash" w="w-4" h="h-4" />
            </div>
          </button>
        </ListContainer>
      </div>
    </div>

    <ImportPlaylistModal v-if="isImportModalOpen" @close="isImportModalOpen = false" @imported="onImported" />
  </div>
</template>
