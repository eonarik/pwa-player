// src/services/library/selectors.ts

import type { Track } from '@/types/track';
import type { Playability } from '@/types/playability';

/**
 * Есть ли у трека локальный источник (handle).
 */
export function hasLocalSource(track: Track | null | undefined): boolean {
  if (!track) return false;
  return track.sources.some((s) => s.kind === 'local');
}

/**
 * Есть ли у трека облачный источник (remotePath).
 */
export function hasCloudSource(track: Track | null | undefined): boolean {
  if (!track) return false;
  return track.sources.some((s) => s.kind === 'cloud');
}

/**
 * Есть ли у трека стриминговый источник (url).
 */
export function hasStreamingSource(track: Track | null | undefined): boolean {
  if (!track) return false;
  return track.sources.some((s) => s.kind === 'streaming');
}

/**
 * Были ли метаданные трека изменены вручную или через автопоиск.
 * (То есть текущие метаданные не являются исходными из файла).
 */
export function isTrackMetadataModified(track: Track | null | undefined): boolean {
  if (!track) return false;
  return track.metaSource === 'manual' || track.metaSource === 'auto';
}

export interface PlayabilityContext {
  isPluginDisconnected: boolean;
  isDownloading: boolean;
}

/**
 * Можно ли воспроизвести трек прямо сейчас.
 */
export function getPlayability(track: Track | null | undefined, ctx: PlayabilityContext): Playability {
  if (!track) return 'missing';

  if (ctx.isDownloading) return 'downloading';

  if (track.sources.length === 0) return 'missing';

  // local-source с handle → playable
  if (track.sources.some((s) => s.kind === 'local' && s.handle)) {
    return 'playable';
  }

  // cloud-source → нужна сессия
  if (track.sources.some((s) => s.kind === 'cloud')) {
    return ctx.isPluginDisconnected ? 'needs-reconnect' : 'playable-streaming';
  }

  // streaming-source → playable-streaming
  if (track.sources.some((s) => s.kind === 'streaming')) {
    return 'playable-streaming';
  }

  return 'missing';
}
