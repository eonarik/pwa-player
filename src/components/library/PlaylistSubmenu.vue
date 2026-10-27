<!-- src/components/library/PlaylistSubmenu.vue -->
<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistsStore } from '@/stores/playlists'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import Icon from '@/components/ui/Icon.vue'
import type { Track } from '@/types/track'

const props = defineProps<{
  tracks: Track[]
  inDropdown?: boolean
  /** Если true, список сразу открыт (для кнопки "плюсик") */
  forceOpen?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const router = useRouter()
const playlists = usePlaylistsStore()

const isSubmenuOpen = ref(props.forceOpen ?? false)
const isCreatingNew = ref(false)
const newPlaylistName = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

// Следим за forceOpen, если компонент переиспользуется
watch(() => props.forceOpen, (val) => {
  if (val !== undefined) isSubmenuOpen.value = val
})

const userPlaylists = computed(() =>
  playlists.sortedPlaylists.filter((p) => p.id !== FAVORITES_PLAYLIST_ID),
)

function closeMenu() {
  emit('close')
}

function addToPlaylist(playlistId: string) {
  if (props.tracks.length === 0) return
  playlists.addTracksToPlaylist(playlistId, props.tracks)
  closeMenu()
}

function goToPlaylist(playlistId: string, e: Event) {
  e.stopPropagation()
  closeMenu()
  router.push({ name: 'playlist', params: { id: playlistId } })
}

async function startCreate() {
  isCreatingNew.value = true
  newPlaylistName.value = ''
  await nextTick()
  inputRef.value?.focus()
}

function confirmCreate() {
  const name = newPlaylistName.value.trim()
  if (!name) return
  const id = playlists.createPlaylist(name)
  if (props.tracks.length > 0) {
    playlists.addTracksToPlaylist(id, props.tracks)
  }
  closeMenu()
}

function cancelCreate() {
  isCreatingNew.value = false
  newPlaylistName.value = ''
}
</script>

<template>
  <div class="flex flex-col">
    <!-- Триггер -->
    <button v-if="!inDropdown || !isSubmenuOpen" type="button"
      class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
      @click="isSubmenuOpen = !isSubmenuOpen">
      <span>Добавить в плейлист</span>
      <Icon :name="isSubmenuOpen ? 'chevron-down' : 'chevron-right'" w="w-3.5" h="h-3.5" class="text-fg-muted" />
    </button>

    <div v-if="isSubmenuOpen">
      <div v-if="userPlaylists.length > 0" class="flex flex-col">
        <div v-for="p in userPlaylists" :key="p.id" class="group flex items-center">
          <button type="button"
            class="block flex-1 truncate px-6 py-2 text-left text-sm text-fg-muted transition hover:bg-hover-bg hover:text-fg"
            v-tooltip="`Добавить трек в ${p.name}`" @click="addToPlaylist(p.id)">
            {{ p.name }}
          </button>
          <button type="button"
            class="px-3 py-2 text-fg-subtle hover:text-active opacity-0 group-hover:opacity-100 transition"
            v-tooltip="`Перейти в ${p.name}`" @click="(e) => goToPlaylist(p.id, e)">
            <Icon name="chevron-right" w="w-3.5" h="h-3.5" />
          </button>
        </div>
      </div>

      <div v-if="userPlaylists.length === 0 && !isCreatingNew" class="px-6 py-2 text-xs text-fg-subtle">
        Нет плейлистов
      </div>

      <button v-if="!isCreatingNew" type="button"
        class="block w-full px-6 py-2 text-left text-sm text-active transition hover:bg-hover-bg" @click="startCreate">
        + Создать новый
      </button>

      <form v-else class="px-4 py-2" @submit.prevent="confirmCreate">
        <input ref="inputRef" v-model="newPlaylistName" type="text" placeholder="Название плейлиста"
          class="w-full rounded-btn bg-card-bg px-2 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none"
          @keydown.esc="cancelCreate" />
        <div class="mt-2 flex items-center justify-end gap-2">
          <button type="button" class="rounded-btn px-2 py-1 text-xs text-fg-muted transition hover:text-fg"
            @click="cancelCreate">
            Отмена
          </button>
          <button type="submit"
            class="rounded-btn bg-accent px-3 py-1 text-xs font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50"
            :disabled="!newPlaylistName.trim()">
            Создать
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
