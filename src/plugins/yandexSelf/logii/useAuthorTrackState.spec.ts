// src/plugins/yandexSelf/logii/useAuthorTrackState.spec.ts

import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { newTrackId } from '@/types/ids';
import type { Track } from '@/types/track';
import { useAuthorTrackState } from './useAuthorTrackState';

function trackStub(id?: Track['id'], extra: Partial<Track> = {}): Track {
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
    ...extra,
  };
}

describe('useAuthorTrackState', () => {
  it('hasTracks: true когда треки есть', () => {
    const allTracksByAuthor = ref(new Map<string, Track[]>([['logii.S/uA', [trackStub()]]]));
    const state = useAuthorTrackState({
      allTracksByAuthor,
      currentTrackId: ref(null),
      isPlaying: ref(false),
    });

    expect(state.hasTracks('logii.S/uA')).toBe(true);
  });

  it('hasTracks: false когда треков нет', () => {
    const allTracksByAuthor = ref(new Map<string, Track[]>([['logii.S/uA', []]]));
    const state = useAuthorTrackState({
      allTracksByAuthor,
      currentTrackId: ref(null),
      isPlaying: ref(false),
    });

    expect(state.hasTracks('logii.S/uA')).toBe(false);
  });

  it('hasTracks: false когда urlPath отсутствует в карте', () => {
    const allTracksByAuthor = ref(new Map<string, Track[]>([['logii.S/uB', [trackStub()]]]));
    const state = useAuthorTrackState({
      allTracksByAuthor,
      currentTrackId: ref(null),
      isPlaying: ref(false),
    });

    expect(state.hasTracks('logii.S/uA')).toBe(false);
  });

  it('isAuthorCurrent: true когда текущий трек автора', () => {
    const t = trackStub();
    const allTracksByAuthor = ref(new Map<string, Track[]>([['logii.S/uA', [t]]]));
    const state = useAuthorTrackState({
      allTracksByAuthor,
      currentTrackId: ref(t.id),
      isPlaying: ref(false),
    });

    expect(state.isAuthorCurrent('logii.S/uA')).toBe(true);
  });

  it('isAuthorCurrent: false когда текущий трек другого автора', () => {
    const t1 = trackStub();
    const t2 = trackStub();
    const allTracksByAuthor = ref(new Map<string, Track[]>([['logii.S/uA', [t1]], ['logii.S/uB', [t2]]]));
    const state = useAuthorTrackState({
      allTracksByAuthor,
      currentTrackId: ref(t2.id),
      isPlaying: ref(false),
    });

    expect(state.isAuthorCurrent('logii.S/uA')).toBe(false);
  });

  it('isAuthorPlaying: true только когда текущий трек автора И playing', () => {
    const t = trackStub();
    const allTracksByAuthor = ref(new Map<string, Track[]>([['logii.S/uA', [t]]]));
    const state = useAuthorTrackState({
      allTracksByAuthor,
      currentTrackId: ref(t.id),
      isPlaying: ref(true),
    });

    expect(state.isAuthorPlaying('logii.S/uA')).toBe(true);
  });

  it('isAuthorPlaying: false когда трек текущего автора но playing=false', () => {
    const t = trackStub();
    const allTracksByAuthor = ref(new Map<string, Track[]>([['logii.S/uA', [t]]]));
    const state = useAuthorTrackState({
      allTracksByAuthor,
      currentTrackId: ref(t.id),
      isPlaying: ref(false),
    });

    expect(state.isAuthorPlaying('logii.S/uA')).toBe(false);
  });

  it('reactive: обновляет результаты при смене currentTrackId', () => {
    const t1 = trackStub();
    const t2 = trackStub();
    const allTracksByAuthor = ref(new Map<string, Track[]>([['logii.S/uA', [t1]], ['logii.S/uB', [t2]]]));
    const currentTrackId = ref(t1.id);

    const state = useAuthorTrackState({
      allTracksByAuthor,
      currentTrackId,
      isPlaying: ref(true),
    });

    expect(state.isAuthorCurrent('logii.S/uA')).toBe(true);
    expect(state.isAuthorCurrent('logii.S/uB')).toBe(false);

    currentTrackId.value = t2.id;

    expect(state.isAuthorCurrent('logii.S/uA')).toBe(false);
    expect(state.isAuthorCurrent('logii.S/uB')).toBe(true);
  });
});
