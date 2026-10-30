// src/workers/metadata.worker.ts

import { Buffer } from 'buffer';
import process from 'process';

// Полифилы для music-metadata-browser внутри Web Worker
(self as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
(self as unknown as { process: typeof process }).process = process;
(self as unknown as { global: typeof globalThis }).global = self;

import { parseBlob } from 'music-metadata-browser';
import type { TrackMetadata } from '@/services/metadata/types';

export type WorkerInput = { file: File };
export type WorkerOutput = { status: 'success'; data: TrackMetadata | null } | { status: 'error'; message: string };

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  try {
    const { file } = e.data;
    const metadata = await parseBlob(file, {
      duration: true,
      skipCovers: false,
      skipPostHeaders: true,
    });

    const { common, format } = metadata;

    // Реальные теги: есть artist или album (не пустые)
    const hasId3Tags = Boolean(common.artist?.trim() || common.album?.trim());

    if (!hasId3Tags) {
      // Нет тегов — возвращаем null, на фронте сработает fallback (имя файла)
      self.postMessage({ status: 'success', data: null } satisfies WorkerOutput);
      return;
    }

    const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');

    let coverUrl: string | undefined;
    if (common.picture?.[0]) {
      const picture = common.picture[0];
      const data = picture.data instanceof Uint8Array ? picture.data : new Uint8Array(picture.data);
      const bytes = new Uint8Array(data.length);
      bytes.set(data);
      const blob = new Blob([bytes], { type: picture.format });
      coverUrl = URL.createObjectURL(blob);
    }

    const result: TrackMetadata = {
      title: common.title?.trim() || nameWithoutExt,
      artist: common.artist?.trim() || common.albumartist?.trim() || '',
      album: common.album?.trim() || '',
      year: common.year,
      trackNumber: common.track?.no ?? undefined,
      genre: common.genre?.[0],
      duration: format.duration,
      codec: format.codec,
      coverUrl,
      hasId3Tags: true,
    };

    self.postMessage({ status: 'success', data: result } satisfies WorkerOutput);
  } catch (err) {
    self.postMessage({
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    } satisfies WorkerOutput);
  }
};
