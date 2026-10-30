// src/utils/parseFilename.spec.ts

import { describe, it, expect } from 'vitest';
import { guessMetadataFromFilename } from './parseFilename';

describe('guessMetadataFromFilename', () => {
  it('базовый дефис с пробелами', () => {
    expect(guessMetadataFromFilename('foo - bar.mp3')).toEqual({ artist: 'foo', title: 'bar' });
  });

  it('дефис внутри артиста', () => {
    expect(guessMetadataFromFilename('foo-foo - bar.mp3')).toEqual({
      artist: 'foo-foo',
      title: 'bar',
    });
  });

  it('дефис внутри тайтла', () => {
    expect(guessMetadataFromFilename('foo - bar-foo.mp3')).toEqual({
      artist: 'foo',
      title: 'bar-foo',
    });
  });

  it('нет пробелов (слипшийся) — не трогаем', () => {
    expect(guessMetadataFromFilename('foo-foo-bar.mp3')).toEqual({
      artist: '',
      title: 'foo-foo-bar',
    });
  });

  it('длинное тире с пробелами', () => {
    expect(guessMetadataFromFilename('Radiohead – Karma Police.mp3')).toEqual({
      artist: 'Radiohead',
      title: 'Karma Police',
    });
  });

  it('длинное тире без пробелов', () => {
    expect(guessMetadataFromFilename('Radiohead—Karma Police.mp3')).toEqual({
      artist: 'Radiohead',
      title: 'Karma Police',
    });
  });

  it('подчеркивание вместо пробелов', () => {
    expect(guessMetadataFromFilename('Radiohead_-_Karma_Police.mp3')).toEqual({
      artist: 'Radiohead',
      title: 'Karma_Police',
    });
  });

  it('не ломает одиночное подчеркивание', () => {
    expect(guessMetadataFromFilename('my_song.mp3')).toEqual({
      artist: '',
      title: 'my_song',
    });
  });

  it('несколько дефисов — первое вхождение артист', () => {
    expect(guessMetadataFromFilename('Artist - Title - Remix.mp3')).toEqual({
      artist: 'Artist',
      title: 'Title - Remix',
    });
  });

  it('Jay-Z — не трогаем', () => {
    expect(guessMetadataFromFilename('Jay-Z.mp3')).toEqual({
      artist: '',
      title: 'Jay-Z',
    });
  });

  it('Jay-Z - 99 Problems — режем', () => {
    expect(guessMetadataFromFilename('Jay-Z - 99 Problems.mp3')).toEqual({
      artist: 'Jay-Z',
      title: '99 Problems',
    });
  });
});
