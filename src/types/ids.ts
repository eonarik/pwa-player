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

/** Любой брендированный id этого модуля. */
export type BrandedId = TrackId | AlbumId | FolderId | TrackSourceId | MetadataCandidateId | PlaylistId;

/**
 * Идентификатор приходит из внешнего мира: параметры маршрута, ключи IndexedDB,
 * JSON от сервера. Runtime способно проверить лишь «непустая строка» — на этом
 * основании навешивается бренд. Отсутствие значения возвращаем как undefined,
 * чтобы вызывающий явно решил, что делать (404, пропуск, откат).
 */
function parseBrandedId<T extends BrandedId>(value: unknown): T | undefined {
  return typeof value === 'string' && value.length > 0 ? (value as T) : undefined;
}

/**
 * Явная метка «значение заведомо корректно»: системные константы ядра и тесты.
 * Пустая строка сюда попасть не может — это ошибка программиста, поэтому бросаем.
 */
function brandBrandedId<T extends BrandedId>(value: string, label: string): T {
  if (value.length === 0) {
    throw new Error(`[${label}] пустой идентификатор`);
  }
  return value as T;
}

export const toTrackId = (value: unknown): TrackId | undefined => parseBrandedId<TrackId>(value);
export const toAlbumId = (value: unknown): AlbumId | undefined => parseBrandedId<AlbumId>(value);
export const toFolderId = (value: unknown): FolderId | undefined => parseBrandedId<FolderId>(value);
export const toTrackSourceId = (value: unknown): TrackSourceId | undefined => parseBrandedId<TrackSourceId>(value);
export const toPlaylistId = (value: unknown): PlaylistId | undefined => parseBrandedId<PlaylistId>(value);

export const asTrackId = (value: string): TrackId => brandBrandedId<TrackId>(value, 'TrackId');
export const asAlbumId = (value: string): AlbumId => brandBrandedId<AlbumId>(value, 'AlbumId');
export const asFolderId = (value: string): FolderId => brandBrandedId<FolderId>(value, 'FolderId');
export const asTrackSourceId = (value: string): TrackSourceId => brandBrandedId<TrackSourceId>(value, 'TrackSourceId');
export const asMetadataCandidateId = (value: string): MetadataCandidateId =>
  brandBrandedId<MetadataCandidateId>(value, 'MetadataCandidateId');
export const asPlaylistId = (value: string): PlaylistId => brandBrandedId<PlaylistId>(value, 'PlaylistId');
