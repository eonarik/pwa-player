// src/services/library/TrackMerger/apply.ts

import type { Track } from '@/types/track';
import type { LibraryWriter } from '@/services/library/LibraryWriter';
import type { MergeResult, MergeManyResult } from './merge';

export interface ApplyDeps {
  writer: LibraryWriter;
}

export function apply(result: MergeResult, deps: ApplyDeps): string | null {
  const { writer } = deps;
  const pluginId = result.track.sources[0]?.pluginId ?? null;

  if (result.action === 'created' || result.action === 'merged-soft') {
    if (result.album) {
      writer.addAlbums([result.album]);
    }
    writer.addTracks([result.track], pluginId ?? '');
  } else if (result.action === 'merged-strict') {
    if (result.album) {
      writer.addOrUpdateAlbum(result.album);
    }
    writer.updateTrackSources(result.track.id, result.track.sources);
    if (result.track.albumId !== null) {
      writer.updateTrackAlbumId(result.track.id, result.track.albumId);
    }
  }

  return pluginId;
}

export interface ApplyManyDeps {
  writer: LibraryWriter;
}

export function applyMany(many: MergeManyResult, deps: ApplyManyDeps): string[] {
  const { writer } = deps;
  const pluginIds = new Set<string>();

  if (many.albums.length > 0) {
    writer.addAlbums(many.albums);
  }

  const createdTracks: Track[] = [];

  for (const result of many.results) {
    if (result.action === 'created' || result.action === 'merged-soft') {
      createdTracks.push(result.track);
      const pid = result.track.sources[0]?.pluginId;
      if (pid) pluginIds.add(pid);
    }
  }

  if (createdTracks.length > 0) {
    const byPlugin = new Map<string, Track[]>();
    for (const track of createdTracks) {
      const pid = track.sources[0]?.pluginId ?? '';
      const list = byPlugin.get(pid) ?? [];
      list.push(track);
      byPlugin.set(pid, list);
    }
    for (const [pid, tracks] of byPlugin) {
      writer.addTracks(tracks, pid);
    }
  }

  for (const result of many.results) {
    if (result.action === 'merged-strict') {
      writer.updateTrackSources(result.track.id, result.track.sources);
      if (result.track.albumId !== null) {
        writer.updateTrackAlbumId(result.track.id, result.track.albumId);
      }
      const pid = result.track.sources[0]?.pluginId;
      if (pid) pluginIds.add(pid);
    }
  }

  return Array.from(pluginIds);
}
