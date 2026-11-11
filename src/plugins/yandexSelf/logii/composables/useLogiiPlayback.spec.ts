// src/plugins/yandexSelf/logii/composables/useLogiiPlayback.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import type { Track } from '@/types/track';
import { newFolderId, newTrackId } from '@/types/ids';
import type { LogiiAuthorItem, LogiiTrackItem } from '../useLogiiData';
import { useLogiiPlayback, type LogiiPlayerApi } from './useLogiiPlayback';

function trackStub(id?: Track['id']): Track {
  return {
    id: id ?? newTrackId(),
    pluginId: 'yandex-self',
    artist: 'Artist',
    title: 'Title',
    albumId: null,
    coverUrl: null,
    sources: [],
    metadataCandidates: [],
    raw: null,
    hasId3Tags: false,
  };
}

function folderStub(audioTracks: Track[] = []): LogiiTrackItem {
  return {
    folderName: '1',
    urlPath: 'logii.S/uA/1',
    folderId: newFolderId(),
    isIntro: false,
    audioTracks,
    imageFiles: [],
    logiiFileName: null,
  };
}

const author: LogiiAuthorItem = { folderName: 'uA', urlPath: 'logii.S/uA' };

function setup(options: {
  currentFolder?: LogiiTrackItem | null;
  allTracksByAuthor?: Map<string, Track[]>;
  player?: Partial<LogiiPlayerApi>;
} = {}) {
  const player: LogiiPlayerApi = {
    setQueue: vi.fn(),
    playAll: vi.fn(),
    toggle: vi.fn(),
    currentTrack: null,
    isPlaying: false,
    ...options.player,
  };

  const api = useLogiiPlayback({
    currentFolder: computed(() => (options.currentFolder === undefined ? null : options.currentFolder)),
    allTracksByAuthor: ref(options.allTracksByAuthor ?? new Map<string, Track[]>()),
    player,
  });
  return { ...api, player };
}

describe('useLogiiPlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('playTrack: пустая папка - очередь не ставится', () => {
    const { playTrack, player } = setup({ currentFolder: folderStub([]) });
    playTrack(0);
    expect(player.setQueue).not.toHaveBeenCalled();
  });

  it('playTrack: ставит очередь папки с указанного индекса', () => {
    const tracks = [trackStub(), trackStub()];
    const { playTrack, player } = setup({ currentFolder: folderStub(tracks) });
    playTrack(1);
    expect(player.setQueue).toHaveBeenCalledWith(tracks, 1);
  });

  it('playAllAudio: проигрывает все аудио текущей папки', () => {
    const tracks = [trackStub()];
    const empty = setup({ currentFolder: null });
    empty.playAllAudio();
    expect(empty.player.playAll).not.toHaveBeenCalled();

    const { playAllAudio, player } = setup({ currentFolder: folderStub(tracks) });
    playAllAudio();
    expect(player.playAll).toHaveBeenCalledWith(tracks);
  });

  it('playAuthor: без треков ничего не делает', () => {
    const { playAuthor, player } = setup({ allTracksByAuthor: new Map() });
    playAuthor(author);
    expect(player.playAll).not.toHaveBeenCalled();
    expect(player.toggle).not.toHaveBeenCalled();
  });

  it('playAuthor: текущий трек автора и игра - пауза вместо перезапуска', () => {
    const current = trackStub();
    const { playAuthor, player } = setup({
      allTracksByAuthor: new Map([[author.urlPath, [current]]]),
      player: { currentTrack: current, isPlaying: true },
    });

    playAuthor(author);

    expect(player.toggle).toHaveBeenCalledTimes(1);
    expect(player.playAll).not.toHaveBeenCalled();
  });

  it('playAuthor: чужой текущий трек - играет автора с начала', () => {
    const { playAuthor, player } = setup({
      allTracksByAuthor: new Map([[author.urlPath, [trackStub()]]]),
      player: { currentTrack: trackStub(), isPlaying: true },
    });

    playAuthor(author);

    expect(player.playAll).toHaveBeenCalledTimes(1);
    expect(player.toggle).not.toHaveBeenCalled();
  });
});
