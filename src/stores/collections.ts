// src/stores/collections.ts

import { usePlaylistsStore } from './playlists';
import { useHistoryStore } from './history';
import { useDislikesStore } from './dislikes';

/**
 * Единый фасад над тремя сторами коллекций.
 * Не хранит состояние — только делегирует.
 *
 * Использование: `const collections = useCollectionsStore()`.
 */
export function useCollectionsStore() {
  const playlists = usePlaylistsStore();
  const history = useHistoryStore();
  const dislikes = useDislikesStore();

  return {
    // --- Плейлисты ---
    playlists: playlists.playlists,
    sortedPlaylists: playlists.sortedPlaylists,
    favorites: playlists.favorites,
    favoriteTrackIds: playlists.favoriteTrackIds,
    createPlaylist: playlists.createPlaylist,
    renamePlaylist: playlists.renamePlaylist,
    deletePlaylist: playlists.deletePlaylist,
    addTracksToPlaylist: playlists.addTracksToPlaylist,
    removeTrackFromPlaylist: playlists.removeTrackFromPlaylist,
    isFavorite: playlists.isFavorite,
    toggleFavorite: playlists.toggleFavorite,
    getPlaylist: playlists.getPlaylist,

    // --- История ---
    history: history.history,
    historyEntries: history.entries,
    sortedHistory: history.sortedHistory,
    uniqueHistory: history.uniqueHistory,
    isHistoryEmpty: history.isEmpty,
    recordPlay: history.recordPlay,
    getHistoryEntry: history.getEntry,
    clearHistory: history.clear,

    // --- Дизлайки ---
    dislikes: dislikes.dislikes,
    dislikeEntries: dislikes.entries,
    sortedDislikes: dislikes.sortedEntries,
    dislikedIds: dislikes.dislikedIds,
    isDisliked: dislikes.isDisliked,
    dislike: dislikes.dislike,
    undislike: dislikes.undislike,
    toggleDislike: dislikes.toggleDislike,
    clearDislikes: dislikes.clear,
  };
}
