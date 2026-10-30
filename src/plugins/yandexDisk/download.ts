// src/plugins/yandexDisk/download.ts

import type { PluginContext, DownloadTrackOptions, DownloadedTrackInfo } from '../types';
import type { Track, TrackSource } from '@/types/track';
import { downloadUrlToFile } from '@/services/download/downloadUrlToFile';

export interface DownloadDeps {
  buildDownloadUrl: (track: Track, source: TrackSource) => string;
}

export async function downloadTrackToDir(
  deps: DownloadDeps,
  _context: PluginContext,
  track: Track,
  source: TrackSource,
  options: DownloadTrackOptions,
): Promise<DownloadedTrackInfo> {
  const url = deps.buildDownloadUrl(track, source);
  if (source.kind !== 'cloud') {
    throw new Error(`[yandex] downloadTrack: source must be cloud, got "${source.kind}"`);
  }

  const cleanRemote = source.remotePath.replace(/^disk:/, '').replace(/^\/+/, '');
  const relativePath = cleanRemote || track.title;

  const result = await downloadUrlToFile(url, {
    targetDir: options.targetDir,
    relativePath,
    onProgress: options.onProgress,
    signal: options.signal,
  });
  return { relativePath, size: result.size, handle: result.handle };
}

export async function removeDownloadedFromDir(
  _context: PluginContext,
  _track: Track,
  source: TrackSource,
  targetDir: FileSystemDirectoryHandle,
): Promise<void> {
  if (source.kind !== 'local') return;
  if (!source.relativePath) return;

  const segments = source.relativePath.split('/').filter(Boolean);
  const fileName = segments.pop();
  if (!fileName) return;

  try {
    let dir = targetDir;
    for (const seg of segments) dir = await dir.getDirectoryHandle(seg);
    await dir.removeEntry(fileName);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') return;
    throw err;
  }
}
