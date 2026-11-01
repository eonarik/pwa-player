// src/services/playlists/ImportService.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { parsePlaylistText, importPlaylist } from './ImportService';
import { useLibraryStore } from '@/stores/library';
import { usePlaylistsStore } from '@/stores/playlists';
import { newTrackId } from '@/types/ids';
import type { Track } from '@/types/track';

vi.mock('@/plugins/registry', () => ({
  loadPlugin: vi.fn().mockResolvedValue({ saveCache: vi.fn() }),
  pluginIdFromSource: vi.fn((id: string) => id.split(':')[0]),
}));

function makeTrack(artist: string, title: string, albumId = null): Track {
  return {
    id: newTrackId(),
    pluginId: 'local',
    artist,
    title,
    albumId,
    coverUrl: null,
    sources: [
      {
        id: 'src-1' as never,
        pluginId: 'local',
        priority: 10,
        kind: 'local',
        handle: {} as FileSystemFileHandle,
        folderId: 'f1' as never,
      },
    ],
    metadataCandidates: [],
    raw: null,
    hasId3Tags: true,
  };
}

describe('ImportService', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  describe('parsePlaylistText', () => {
    it('парсит M3U', async () => {
      const m3u = '#EXTM3U\n#EXTINF:-1,Artist A - Track 1\n/track1.mp3';
      const res = await parsePlaylistText(m3u, 'My M3U');
      expect(res?.name).toBe('My M3U');
      expect(res?.tracks).toHaveLength(1);
      expect(res?.tracks[0]?.artist).toBe('Artist A');
    });

    it('парсит JSON', async () => {
      const json = JSON.stringify({
        format: 'cuei-playlist',
        name: 'My JSON',
        tracks: [{ artist: 'Artist B', title: 'Track 2' }],
      });
      const res = await parsePlaylistText(json);
      expect(res?.name).toBe('My JSON');
      expect(res?.tracks[0]?.artist).toBe('Artist B');
    });

    it('парсит Blueprint', async () => {
      const { encodeBlueprint } = await import('@/utils/playlistBlueprint');
      const encoded = await encodeBlueprint({
        n: 'My Blueprint',
        tr: [{ a: 'Artist C', t: 'Track 3' }],
      });
      const res = await parsePlaylistText(encoded);
      expect(res?.name).toBe('My Blueprint');
      expect(res?.tracks[0]?.artist).toBe('Artist C');
    });

    it('возвращает null для неверного формата', async () => {
      expect(await parsePlaylistText('invalid text')).toBeNull();
    });
  });

  describe('importPlaylist', () => {
    it('создаёт плейлист, находит точные, fuzzy и unmatched треки', async () => {
      const library = useLibraryStore();
      const playlists = usePlaylistsStore();

      // Библиотека
      const exactTrack = makeTrack('Radiohead', 'Creep');
      const fuzzyTrack = makeTrack('Muse', 'Supermassive Black Hole');
      library.tracks[exactTrack.id] = exactTrack;
      library.tracks[fuzzyTrack.id] = fuzzyTrack;

      // Импорт
      const res = await importPlaylist({
        name: 'My Import',
        tracks: [
          { artist: 'Radiohead', title: 'Creep' }, // exact
          { artist: 'Muse', title: 'Supermassive Black Hol' }, // fuzzy
          { artist: 'Unknown', title: 'Something New' }, // unmatched
        ],
      });

      expect(res.playlistId).toBeDefined();
      expect(res.stats).toEqual({ total: 3, exact: 1, fuzzy: 1, unmatched: 1 });

      const playlist = playlists.getPlaylist(res.playlistId);
      expect(playlist?.trackIds).toHaveLength(3);
    });
  });
});
