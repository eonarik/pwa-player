<!-- src/components/library/PlaylistSubmenu.vue -->

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { usePlaylistsStore } from '@/stores/playlists';
import { toastService } from '@/services/ui/ToastService';
import { FAVORITES_PLAYLIST_ID } from '@/types/collection';
import type { PlaylistId } from '@/types/ids';
import Icon from '@/components/ui/Icon.vue';
import type { Track } from '@/types/track';

const props = defineProps<{
  tracks: Track[];
  inDropdown?: boolean;
  forceOpen?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const router = useRouter();
const playlists = usePlaylistsStore();

const isSubmenuOpen = ref(props.forceOpen ?? false);
const isCreatingNew = ref(false);
const newPlaylistName = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.forceOpen,
  (val) => {
    if (val !== undefined) isSubmenuOpen.value = val;
  },
);

const userPlaylists = computed(() => playlists.sortedPlaylists.filter((p) => p.id !== FAVORITES_PLAYLIST_ID));

function isTrackInPlaylist(playlistId: PlaylistId): boolean {
  if (props.tracks.length === 0) return false;
  const playlist = playlists.getPlaylist(playlistId);
  if (!playlist) return false;

  if (props.tracks.length === 1) {
    return playlist.trackIds.includes(props.tracks[0]!.id);
  }

  return props.tracks.every((t) => playlist.trackIds.includes(t.id));
}

async function togglePlaylist(playlistId: PlaylistId) {
  if (props.tracks.length === 0) return;

  const playlist = playlists.getPlaylist(playlistId);
  if (!playlist) return;

  const isInPlaylist = isTrackInPlaylist(playlistId);

  if (isInPlaylist) {
    // Удаляем
    if (props.tracks.length === 1) {
      playlists.removeTrackFromPlaylist(playlistId, props.tracks[0]!.id);
      toastService.success(`Удалено из «${playlist.name}»`);
    } else {
      // Если добавляли пачку, и они все там — удаляем все
      for (const track of props.tracks) {
        playlists.removeTrackFromPlaylist(playlistId, track.id);
      }
      toastService.success(`Удалено ${props.tracks.length} треков из «${playlist.name}»`);
    }
  } else {
    // Добавляем
    const addedCount = await playlists.addTracksToPlaylist(playlistId, props.tracks);
    if (addedCount > 0) {
      if (props.tracks.length === 1) {
        toastService.success(`Добавлено в «${playlist.name}»`);
      } else {
        toastService.success(`Добавлено треков: ${addedCount} в «${playlist.name}»`);
      }
    } else {
      toastService.info('Все выбранные треки уже в этом плейлисте');
    }
  }
  // Меню не закрываем
}

function goToPlaylist(playlistId: PlaylistId, e: Event) {
  e.stopPropagation();
  emit('close');
  router.push({ name: 'playlist', params: { id: playlistId } });
}

async function startCreate() {
  isCreatingNew.value = true;
  newPlaylistName.value = '';
  await nextTick();
  inputRef.value?.focus();
}

async function confirmCreate() {
  const name = newPlaylistName.value.trim();
  if (!name) return;
  const id = playlists.createPlaylist(name);
  if (props.tracks.length > 0) {
    await playlists.addTracksToPlaylist(id, props.tracks);
  }

  const playlist = playlists.getPlaylist(id);
  if (playlist) toastService.success(`Создан плейлист «${playlist.name}»`);

  isCreatingNew.value = false;
  newPlaylistName.value = '';
}

function cancelCreate() {
  isCreatingNew.value = false;
  newPlaylistName.value = '';
}
</script>

<template>
  <div class="flex flex-col">
    <button
      v-if="!inDropdown || !isSubmenuOpen"
      type="button"
      class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
      @click="isSubmenuOpen = !isSubmenuOpen"
    >
      <span>Добавить в плейлист</span>
      <Icon :name="isSubmenuOpen ? 'chevron-down' : 'chevron-right'" w="w-3.5" h="h-3.5" class="text-fg-muted" />
    </button>

    <div v-if="isSubmenuOpen">
      <div v-if="userPlaylists.length > 0" class="flex flex-col">
        <div v-for="p in userPlaylists" :key="p.id" class="group flex items-center">
          <button
            type="button"
            class="flex flex-1 items-center gap-2 truncate px-4 py-2 text-left text-sm transition"
            :class="
              isTrackInPlaylist(p.id)
                ? 'text-active hover:bg-hover-bg'
                : 'text-fg-muted hover:bg-hover-bg hover:text-fg'
            "
            v-tooltip="isTrackInPlaylist(p.id) ? `Удалить из ${p.name}` : `Добавить в ${p.name}`"
            @click="togglePlaylist(p.id)"
          >
            <!-- Галочка слева -->
            <div class="flex w-4 shrink-0 items-center justify-center">
              <Icon v-if="isTrackInPlaylist(p.id)" name="check" w="w-3.5" h="h-3.5" />
            </div>
            <span class="truncate">{{ p.name }}</span>
          </button>

          <button
            type="button"
            class="px-3 py-2 text-fg-subtle hover:text-active opacity-0 group-hover:opacity-100 transition"
            v-tooltip="`Перейти в ${p.name}`"
            @click="(e) => goToPlaylist(p.id, e)"
          >
            <Icon name="chevron-right" w="w-3.5" h="h-3.5" />
          </button>
        </div>
      </div>

      <div v-if="userPlaylists.length === 0 && !isCreatingNew" class="px-6 py-2 text-xs text-fg-subtle">
        Нет плейлистов
      </div>

      <button
        v-if="!isCreatingNew"
        type="button"
        class="block w-full px-4 py-2 text-left text-sm text-active transition hover:bg-hover-bg"
        @click="startCreate"
      >
        + Создать новый
      </button>

      <form v-else class="px-4 py-2" @submit.prevent="confirmCreate">
        <input
          ref="inputRef"
          v-model="newPlaylistName"
          type="text"
          placeholder="Название плейлиста"
          class="w-full rounded-btn bg-card-bg px-2 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none"
          @keydown.esc="cancelCreate"
        />
        <div class="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-btn px-2 py-1 text-xs text-fg-muted transition hover:text-fg"
            @click="cancelCreate"
          >
            Отмена
          </button>
          <button
            type="submit"
            class="rounded-btn bg-accent px-3 py-1 text-xs font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50"
            :disabled="!newPlaylistName.trim()"
          >
            Создать
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
