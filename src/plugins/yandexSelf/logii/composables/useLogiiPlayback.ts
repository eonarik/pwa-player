// src/plugins/yandexSelf/logii/composables/useLogiiPlayback.ts

import { type ComputedRef, type Ref } from 'vue';
import type { Track } from '@/types/track';
import type { LogiiAuthorItem, LogiiTrackItem } from '../useLogiiData';

export interface LogiiPlayerApi {
  setQueue(tracks: Track[], index: number): void;
  playAll(tracks: Track[]): void;
  toggle(): void;
  readonly currentTrack: Track | null;
  readonly isPlaying: boolean;
}

export interface LogiiPlayback {
  playTrack: (index: number) => void;
  playAllAudio: () => void;
  playAuthor: (author: LogiiAuthorItem) => void;
}

export interface LogiiPlaybackDeps {
  currentFolder: ComputedRef<LogiiTrackItem | null>;
  allTracksByAuthor: Ref<Map<string, Track[]>>;
  player: LogiiPlayerApi;
}

export function useLogiiPlayback(deps: LogiiPlaybackDeps): LogiiPlayback {
  function playTrack(index: number): void {
    const tracks = deps.currentFolder.value?.audioTracks ?? [];
    if (tracks.length === 0) return;
    deps.player.setQueue(tracks, index);
  }

  function playAllAudio(): void {
    const tracks = deps.currentFolder.value?.audioTracks ?? [];
    if (tracks.length === 0) return;
    deps.player.playAll(tracks);
  }

  function playAuthor(author: LogiiAuthorItem): void {
    const tracks = deps.allTracksByAuthor.value.get(author.urlPath) ?? [];
    if (tracks.length === 0) return;

    const currentId = deps.player.currentTrack?.id ?? null;
    const isThisAuthorCurrent = currentId !== null && tracks.some((t) => t.id === currentId);

    if (isThisAuthorCurrent && deps.player.isPlaying) {
      deps.player.toggle();
      return;
    }

    deps.player.playAll(tracks);
  }

  return { playTrack, playAllAudio, playAuthor };
}
