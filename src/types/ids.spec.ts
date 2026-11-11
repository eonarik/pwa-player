// src/types/ids.spec.ts

import { describe, expect, it } from 'vitest';

import {
  asAlbumId,
  asFolderId,
  asMetadataCandidateId,
  asPlaylistId,
  asTrackId,
  asTrackSourceId,
  newAlbumId,
  newFolderId,
  newPlaylistId,
  newTrackId,
  newTrackSourceId,
  toAlbumId,
  toFolderId,
  toPlaylistId,
  toTrackId,
  toTrackSourceId,
} from './ids';

/** Guard-конвертеры для данных из внешнего мира. */
const parsers = [
  ['TrackId', toTrackId],
  ['AlbumId', toAlbumId],
  ['FolderId', toFolderId],
  ['TrackSourceId', toTrackSourceId],
  ['PlaylistId', toPlaylistId],
] as const;

/** Явные метки «значение заведомо корректно». */
const casters = [asTrackId, asAlbumId, asFolderId, asTrackSourceId, asPlaylistId, asMetadataCandidateId] as const;

describe('to*Id (границы системы)', () => {
  it.each(parsers)('%s: принимает непустую строку', (_label, parse) => {
    expect(parse('a1b2c3')).toBe('a1b2c3');
  });

  it.each(parsers)('%s: отклоняет отсутствие значения и не-строку', (_label, parse) => {
    expect(parse('')).toBeUndefined();
    expect(parse(undefined)).toBeUndefined();
    expect(parse(null)).toBeUndefined();
    expect(parse(42)).toBeUndefined();
    expect(parse({})).toBeUndefined();
  });

  it('значение, созданное new*Id, проходит через guard', () => {
    const trackId = newTrackId();
    expect(toTrackId(trackId)).toBe(trackId);
    expect(toAlbumId(newAlbumId())).toBeDefined();
    expect(toFolderId(newFolderId())).toBeDefined();
    expect(toTrackSourceId(newTrackSourceId())).toBeDefined();
    expect(toPlaylistId(newPlaylistId())).toBeDefined();
  });
});

describe('as*Id (внутренние константы и тесты)', () => {
  it.each(casters.map((cast, index) => [`#${index + 1}`, cast]))('%s: возвращает то же значение', (_label, cast) => {
    expect(cast('fixed-id')).toBe('fixed-id');
  });

  it('бросает на пустой строке вместо молчаливого невалидного id', () => {
    expect(() => asTrackId('')).toThrow('пустой идентификатор');
    expect(() => asAlbumId('')).toThrow('пустой идентификатор');
    expect(() => asFolderId('')).toThrow('пустой идентификатор');
    expect(() => asTrackSourceId('')).toThrow('пустой идентификатор');
    expect(() => asPlaylistId('')).toThrow('пустой идентификатор');
    expect(() => asMetadataCandidateId('')).toThrow('пустой идентификатор');
  });
});
