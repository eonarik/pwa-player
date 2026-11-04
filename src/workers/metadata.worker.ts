// src/workers/metadata.worker.ts

import { Buffer } from 'buffer';
import process from 'process';

(self as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
(self as unknown as { process: typeof process }).process = process;
(self as unknown as { global: typeof globalThis }).global = self;

import { parseBlob } from 'music-metadata-browser';
import type { TrackMetadata, ParsedId3 } from '@/services/metadata/types';

export type WorkerInput = { file: File };

export type WorkerOutput =
  | { status: 'success'; data: TrackMetadata; coverBlob: Blob | null }
  | { status: 'success'; data: null }
  | { status: 'error'; message: string };

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  try {
    const { file } = e.data;
    const metadata = await parseBlob(file, {
      duration: true,
      skipCovers: false,
      skipPostHeaders: true,
    });

    const { common, format } = metadata;

    const hasId3Tags = Boolean(common.artist?.trim() || common.album?.trim());

    let coverBlob: Blob | null = null;
    if (common.picture?.[0]) {
      const picture = common.picture[0];
      const data = picture.data instanceof Uint8Array ? picture.data : new Uint8Array(picture.data);
      const bytes = new Uint8Array(data.length);
      bytes.set(data);
      coverBlob = new Blob([bytes], { type: picture.format });
    }

    // Нет ни тегов, ни обложки — возвращаем null.
    // Обложка без тегов (без album) бесполезна: её некуда положить.
    if (!hasId3Tags && !coverBlob) {
      self.postMessage({ status: 'success', data: null } satisfies WorkerOutput);
      return;
    }

    const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');

    const result: TrackMetadata = {
      title: common.title?.trim() || nameWithoutExt,
      artist: common.artist?.trim() || common.albumartist?.trim() || '',
      album: common.album?.trim() || '',
      year: common.year,
      trackNumber: common.track?.no ?? undefined,
      genre: common.genre?.[0],
      duration: format.duration,
      codec: format.codec,
      hasId3Tags,
    };

    self.postMessage({ status: 'success', data: result, coverBlob } satisfies WorkerOutput);
  } catch (err) {
    self.postMessage({
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    } satisfies WorkerOutput);
  }
};

// Неиспользуемый импорт — оставлен для совместимости с `ParsedId3` в типах.
export type { ParsedId3 };
