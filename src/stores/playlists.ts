// src/stores/playlists.ts

import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { playlistPersistenceService } from '@/services/persistence/PlaylistPersistenceService';
import { FAVORITES_PLAYLIST_ID, type Playlist } from '@/types/collection';
import type { PlaylistId, TrackId } from '@/types/ids';
import { newPlaylistId } from '@/types/ids';
import { useLibraryStore } from './library';
import { createLibraryWriter } from './library';
import { merge, apply } from '@/services/library/TrackMerger';
import type { Track } from '@/types/track';
import { useUiSettingsStore } from './uiSettings';

export const usePlaylistsStore = defineStore('playlists', () => {
  const playlists = ref<Record<PlaylistId, Playlist>>({});

  const sortedPlaylists = computed<Playlist[]>(() => {
    return Object.values(playlists.value).sort((a, b) => b.updatedAt - a.updatedAt);
  });

  const favorites = computed<Playlist | null>(() => {
    return playlists.value[FAVORITES_PLAYLIST_ID] ?? null;
  });

  const favoriteTrackIds = computed<Set<TrackId>>(() => {
    const fav = favorites.value;
    if (!fav) return new Set();
    return new Set(fav.trackIds);
  });

  async function restore(): Promise<boolean> {
    const loaded = await playlistPersistenceService.load();
    if (loaded && loaded.length > 0) {
      const record: Record<PlaylistId, Playlist> = {} as Record<PlaylistId, Playlist>;
      for (const p of loaded) {
        record[p.id] = p;
      }
      playlists.value = record;
    }
    ensureFavorites();
    return true;
  }

  function save(): void {
    const plain = Object.values(playlists.value).map((p) => JSON.parse(JSON.stringify(p))) as Playlist[];
    playlistPersistenceService.save(plain);
  }

  watch(playlists, () => save(), { deep: true });

  async function flush(): Promise<void> {
    await playlistPersistenceService.flush();
  }

  function ensureFavorites(): void {
    if (!playlists.value[FAVORITES_PLAYLIST_ID]) {
      const now = Date.now();
      playlists.value[FAVORITES_PLAYLIST_ID] = {
        id: FAVORITES_PLAYLIST_ID,
        name: 'Избранное',
        trackIds: [],
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  function createPlaylist(name: string): PlaylistId {
    const id = newPlaylistId();
    const now = Date.now();
    playlists.value[id] = {
      id,
      name: name.trim() || 'Новый плейлист',
      trackIds: [],
      createdAt: now,
      updatedAt: now,
    };
    return id;
  }

  function renamePlaylist(id: PlaylistId, name: string): void {
    if (id === FAVORITES_PLAYLIST_ID) return;
    const playlist = playlists.value[id];
    if (!playlist) return;
    playlist.name = name.trim() || playlist.name;
    playlist.updatedAt = Date.now();
  }

  function deletePlaylist(id: PlaylistId): void {
    if (id === FAVORITES_PLAYLIST_ID) return;
    delete playlists.value[id];
  }

  async function addTracksToPlaylist(playlistId: PlaylistId, tracks: Track[]): Promise<number> {
    const playlist = playlists.value[playlistId];
    if (!playlist) return 0;

    const library = useLibraryStore();
    const uiSettings = useUiSettingsStore();
    const writer = createLibraryWriter();

    let added = 0;
    const now = Date.now();

    for (const track of tracks) {
      // Мёржим через TrackMerger (может создать новый или найти существующий)
      const incoming = {
        artist: track.artist,
        title: track.title,
        album: track.raw?.album ?? '',
        coverUrl: track.coverUrl,
        duration: track.duration,
        codec: track.codec,
        hasId3Tags: track.hasId3Tags,
        source: track.sources[0]!,
      };

      const mergeResult = merge(incoming, {
        existingTracks: Object.values(library.tracks),
        existingAlbums: Object.values(library.albums),
        threshold: uiSettings.playlistMatchThreshold,
      });

      await apply(mergeResult, {
        writer,
        saveCache: async () => {
          // Сохраняем кэш плагина источника
          const pid = mergeResult.track.sources[0]?.pluginId;
          if (pid) {
            const { loadPlugin } = await import('@/plugins/registry');
            const { createPluginContext } = await import('@/plugins/context');
            try {
              const plugin = await loadPlugin(pid);
              if (plugin.saveCache) {
                await plugin.saveCache(createPluginContext(pid));
              }
            } catch (err) {
              console.warn(`[playlists] saveCache failed for ${pid}`, err);
            }
          }
        },
      });

      if (!playlist.trackIds.includes(mergeResult.track.id)) {
        playlist.trackIds.push(mergeResult.track.id);
        added++;
      }
    }

    if (added > 0) {
      playlist.updatedAt = now;
    }

    return added;
  }

  function removeTrackFromPlaylist(playlistId: PlaylistId, trackId: TrackId): boolean {
    const playlist = playlists.value[playlistId];
    if (!playlist) return false;

    const initialLength = playlist.trackIds.length;
    playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId);

    if (playlist.trackIds.length !== initialLength) {
      playlist.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  function isFavorite(trackId: TrackId): boolean {
    return favoriteTrackIds.value.has(trackId);
  }

  async function toggleFavorite(track: Track): Promise<boolean> {
    ensureFavorites();
    if (isFavorite(track.id)) {
      removeTrackFromPlaylist(FAVORITES_PLAYLIST_ID, track.id);
      return false;
    } else {
      await addTracksToPlaylist(FAVORITES_PLAYLIST_ID, [track]);
      return true;
    }
  }

  function getPlaylist(id: PlaylistId): Playlist | null {
    return playlists.value[id] ?? null;
  }

  function clear(): void {
    playlists.value = {};
    void playlistPersistenceService.clear();
    ensureFavorites();
  }

  return {
    playlists,
    sortedPlaylists,
    favorites,
    favoriteTrackIds,

    restore,
    save,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTracksToPlaylist,
    removeTrackFromPlaylist,
    isFavorite,
    toggleFavorite,
    getPlaylist,
    clear,
    flush,
  };
});
