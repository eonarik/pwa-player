// src/types/ids.ts

/**
 * Брендированные идентификаторы. Все — uuid.
 *
 * Брендирование не даёт случайно передать TrackId туда, где ждут AlbumId.
 */

export type TrackId = string & { readonly __brand: 'TrackId' };
export type AlbumId = string & { readonly __brand: 'AlbumId' };
export type FolderId = string & { readonly __brand: 'FolderId' };
export type TrackSourceId = string & { readonly __brand: 'TrackSourceId' };
export type MetadataCandidateId = string & { readonly __brand: 'MetadataCandidateId' };
export type PlaylistId = string & { readonly __brand: 'PlaylistId' };

/**
 * Хелперы для генерации. Плагины и ядро используют только их.
 * uuid v4 через crypto.randomUUID (браузер и Node 22+).
 */
export const newTrackId = (): TrackId => crypto.randomUUID() as TrackId;
export const newAlbumId = (): AlbumId => crypto.randomUUID() as AlbumId;
export const newFolderId = (): FolderId => crypto.randomUUID() as FolderId;
export const newTrackSourceId = (): TrackSourceId => crypto.randomUUID() as TrackSourceId;
export const newMetadataCandidateId = (): MetadataCandidateId => crypto.randomUUID() as MetadataCandidateId;
export const newPlaylistId = (): PlaylistId => crypto.randomUUID() as PlaylistId;
