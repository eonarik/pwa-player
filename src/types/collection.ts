// src/types/collection.ts

import type { PlaylistId, TrackId } from './ids';

/**
 * Пользовательский плейлист.
 * Хранит ТОЛЬКО trackIds — метаданные трека живут в library.tracks.
 */
export interface Playlist {
  id: PlaylistId;
  name: string;
  trackIds: TrackId[];
  createdAt: number;
  updatedAt: number;
}

/**
 * ID системного плейлиста «Избранное». Лежит в playlists,
 * но UI его выделяет. Не удаляется, не переименовывается.
 */
export const FAVORITES_PLAYLIST_ID = 'playlist:favorites' as PlaylistId;

/**
 * История воспроизведения. Самостоятельный тип (не Playlist).
 * Хранит только TrackId → timestamp последнего проигрывания.
 * Порядок «как играло» — сортировка по playedAt.
 */
export interface HistoryCollection {
  id: 'collection:history';
  playedAt: Record<TrackId, number>;
}

/**
 * Дизлайки. Самостоятельный тип (не Playlist).
 * Хранит только TrackId → timestamp дизлайка.
 */
export interface DislikesCollection {
  id: 'collection:dislikes';
  dislikedAt: Record<TrackId, number>;
}

/**
 * Состояние единого collections-стора.
 */
export interface CollectionsState {
  /** Пользовательские плейлисты + favorites (id = 'playlist:favorites') */
  playlists: Record<PlaylistId, Playlist>;
  history: HistoryCollection;
  dislikes: DislikesCollection;
}

export interface PlaylistExportTrack {
  artist: string;
  title: string;
  album?: string;
  duration?: number;
  path?: string;
}
