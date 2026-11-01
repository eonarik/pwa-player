// src/plugins/yandexDisk/localMatches.ts

import type { PluginContext, PluginSnapshot } from '../types';
import type { Track, TrackSource, CloudTrackSource } from '@/types/track';
import { newTrackSourceId } from '@/types/ids';
import { pluginIdFromSource } from '@/plugins/registry';
import { isAudioFile } from '@/shared/audioExtensions';

export function normalizeRemotePath(p: string | null | undefined): string {
  if (!p) return '';
  return p
    .replace(/^disk:\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

async function getDirByPath(
  targetDir: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<FileSystemDirectoryHandle | null> {
  const segments = relativePath.split('/').filter(Boolean);
  let dir: FileSystemDirectoryHandle = targetDir;
  try {
    for (const seg of segments) {
      dir = await dir.getDirectoryHandle(seg);
    }
    return dir;
  } catch {
    return null;
  }
}

export async function applyLocalMatchesForFolders(
  pluginId: string,
  context: PluginContext,
  folders: PluginSnapshot['folders'],
): Promise<void> {
  if (folders.length === 0) return;

  const targetDir = await context.getDownloadDir?.();
  if (!targetDir) return;

  const writer = context.writer;
  const allTracks = writer.getAllTracks();
  const trackByRemotePath = new Map<string, Track>();

  for (const t of allTracks) {
    const cloudSource = t.sources.find(
      (s): s is CloudTrackSource => s.kind === 'cloud' && pluginIdFromSource(s.pluginId) === pluginId,
    );
    if (cloudSource) {
      const key = normalizeRemotePath(cloudSource.remotePath);
      if (key) {
        trackByRemotePath.set(key, t);
      }
    }
  }

  if (trackByRemotePath.size === 0) return;

  let matched = 0;

  for (const folder of folders) {
    const urlPath = normalizeRemotePath(folder.urlPath);
    const dir = await getDirByPath(targetDir, urlPath);
    if (!dir) continue;

    for await (const entry of dir.values()) {
      if (entry.kind !== 'file') continue;
      if (!isAudioFile(entry.name)) continue;

      const fileRelPath = urlPath ? `${urlPath}/${entry.name}` : entry.name;
      let track = trackByRemotePath.get(fileRelPath);

      if (!track) {
        for (const [key, t] of trackByRemotePath.entries()) {
          if (key.endsWith(fileRelPath)) {
            track = t;
            break;
          }
        }
      }

      if (!track) continue;
      if (track.sources.some((s) => s.kind === 'local')) continue;

      const cloudSource = track.sources.find(
        (s): s is CloudTrackSource => s.kind === 'cloud' && pluginIdFromSource(s.pluginId) === pluginId,
      );
      if (!cloudSource) continue;

      const localSource: TrackSource = {
        id: newTrackSourceId(),
        pluginId,
        priority: 10,
        kind: 'local',
        handle: entry,
        folderId: cloudSource.folderId,
      };

      const nextSources = [localSource, ...track.sources.filter((s) => s.kind !== 'local')].sort(
        (a, b) => a.priority - b.priority,
      );

      writer.updateTrackSources(track.id, nextSources);
      matched++;
    }
  }

  if (matched > 0) {
    console.info(`[${pluginId}] local matches applied: ${matched}`);
  }
}
