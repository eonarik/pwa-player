// src/types/snapshot.ts

import type { Track } from './track'

/**
 * Снимок трека (для плейлистов, истории, дизлайков).
 * Не привязан к папке, но содержит все метаданные и source.
 */
export type TrackSnapshot = Omit<Track, 'folderId'>
