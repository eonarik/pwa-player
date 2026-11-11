// src/plugins/podcasts/episodeTrack.spec.ts

import { describe, expect, it } from 'vitest';
import type { Episode } from './types';
import { episodeToTrack, episodesToTracks } from './episodeTrack';

function ep(id: string, over: Partial<Episode> = {}): Episode {
  return {
    id,
    podcastId: 'p1',
    title: `Эпизод ${id}`,
    description: '',
    audioUrl: `https://cdn.example.com/${id}.mp3`,
    sizeBytes: null,
    durationSec: null,
    publishedAt: 0,
    image: '',
    ...over,
  };
}

describe('episodeToTrack', () => {
  it('заполняет title и artist из подкаста', () => {
    const track = episodeToTrack(ep('e1'), { podcastTitle: 'Мой подкаст', fallbackCover: null, pluginId: 'podcasts' });
    expect(track.title).toBe('Эпизод e1');
    expect(track.artist).toBe('Мой подкаст');
  });

  it('обложка берётся из эпизода, если указана', () => {
    const track = episodeToTrack(ep('e1', { image: 'https://img/e.jpg' }), {
      podcastTitle: 'Мой подкаст',
      fallbackCover: 'https://img/feed.jpg',
      pluginId: 'podcasts',
    });
    expect(track.coverUrl).toBe('https://img/e.jpg');
  });

  it('обложка подкаста используется как падбэк', () => {
    const track = episodeToTrack(ep('e1', { image: '' }), {
      podcastTitle: 'Мой подкаст',
      fallbackCover: 'https://img/feed.jpg',
      pluginId: 'podcasts',
    });
    expect(track.coverUrl).toBe('https://img/feed.jpg');
  });

  it('нет обложки ни у эпизода, ни у подкаста — null', () => {
    const track = episodeToTrack(ep('e1', { image: '' }), {
      podcastTitle: 'Мой подкаст',
      fallbackCover: null,
      pluginId: 'podcasts',
    });
    expect(track.coverUrl).toBeNull();
  });

  it('duration: число сохраняется, null уходит в undefined', () => {
    const withDuration = episodeToTrack(ep('e1', { durationSec: 120 }), {
      podcastTitle: 'Мой подкаст',
      fallbackCover: null,
      pluginId: 'podcasts',
    });
    expect(withDuration.duration).toBe(120);

    const without = episodeToTrack(ep('e1', { durationSec: null }), {
      podcastTitle: 'Мой подкаст',
      fallbackCover: null,
      pluginId: 'podcasts',
    });
    expect(without.duration).toBeUndefined();
  });

  it('source: streaming, priority 30, url из эпизода', () => {
    const track = episodeToTrack(ep('e1'), { podcastTitle: 'Мой подкаст', fallbackCover: null, pluginId: 'podcasts' });
    expect(track.sources).toHaveLength(1);
    expect(track.sources[0]).toMatchObject({
      kind: 'streaming',
      priority: 30,
      url: 'https://cdn.example.com/e1.mp3',
      pluginId: 'podcasts',
    });
  });

  it('id трека и источника уникальны', () => {
    const t1 = episodeToTrack(ep('e1'), { podcastTitle: 'Мой подкаст', fallbackCover: null, pluginId: 'podcasts' });
    const t2 = episodeToTrack(ep('e2'), { podcastTitle: 'Мой подкаст', fallbackCover: null, pluginId: 'podcasts' });
    expect(t1.id).not.toBe(t2.id);
    expect(t1.sources[0]!.id).not.toBe(t2.sources[0]!.id);
  });

  it('необязательные поля всегда заполнены по умолчанию', () => {
    const track = episodeToTrack(ep('e1'), { podcastTitle: 'Мой подкаст', fallbackCover: null, pluginId: 'podcasts' });
    expect(track.metadataCandidates).toEqual([]);
    expect(track.raw).toBeNull();
    expect(track.hasId3Tags).toBe(false);
    expect(track.albumId).toBeNull();
  });
});

describe('episodesToTracks', () => {
  it('преобразует список эпизодов в массив треков с сохранением порядка', () => {
    const tracks = episodesToTracks([ep('a'), ep('b'), ep('c')], {
      podcastTitle: 'Мой подкаст',
      fallbackCover: null,
      pluginId: 'podcasts',
    });
    expect(tracks).toHaveLength(3);
    expect(tracks.map((t) => t.title)).toEqual(['Эпизод a', 'Эпизод b', 'Эпизод c']);
    expect(tracks.every((t) => t.artist === 'Мой подкаст')).toBe(true);
  });

  it('пустой список даёт пустой массив', () => {
    const tracks = episodesToTracks([], { podcastTitle: 'Мой подкаст', fallbackCover: null, pluginId: 'podcasts' });
    expect(tracks).toHaveLength(0);
  });

  it('обложка подкаста применяется как падбэк ко всем эпизодам без своей', () => {
    const tracks = episodesToTracks([ep('a', { image: '' }), ep('b', { image: '' })], {
      podcastTitle: 'Мой подкаст',
      fallbackCover: 'https://feed/img.jpg',
      pluginId: 'podcasts',
    });
    expect(tracks.map((t) => t.coverUrl)).toEqual(['https://feed/img.jpg', 'https://feed/img.jpg']);
  });

  it('каждый трек имеет уникальный id', () => {
    const tracks = episodesToTracks([ep('1'), ep('2'), ep('3')], {
      podcastTitle: 'Мой подкаст',
      fallbackCover: null,
      pluginId: 'podcasts',
    });
    const ids = tracks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('обёртка с id3 и metadata пустая', () => {
    const tracks = episodesToTracks([ep('a')], { podcastTitle: 'Мой подкаст', fallbackCover: null, pluginId: 'podcasts' });
    expect(tracks[0]!.hasId3Tags).toBe(false);
    expect(tracks[0]!.metadataCandidates).toEqual([]);
    expect(tracks[0]!.raw).toBeNull();
    expect(tracks[0]!.albumId).toBeNull();
  });
});
