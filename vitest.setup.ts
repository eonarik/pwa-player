// vitest.setup.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { vi, beforeEach, afterEach } from 'vitest';
import { MockAudio } from './src/test/mockAudio';
import { audioMockState } from './src/test/audioMockState';
import zlib from 'node:zlib';

// Прямое присваивание вместо stubGlobal — надёжнее для jsdom-встроенных классов
(globalThis as any).Audio = class {
  constructor() {
    const instance = new MockAudio();
    audioMockState.instances.push(instance);
    return instance;
  }
};

vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
  audioMockState.urlCounter++;
  return `blob:mock-${audioMockState.urlCounter}`;
});

vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
  audioMockState.revokedUrls.push(url);
});

// --- Полифилы для Streams API (нужны для playlistBlueprint) ---------

if (typeof Blob !== 'undefined' && !(Blob.prototype as any).stream) {
  (Blob.prototype as any).stream = function () {
    const blob = this as Blob;
    return new ReadableStream({
      async start(controller) {
        try {
          const buffer = await blob.arrayBuffer();
          controller.enqueue(new Uint8Array(buffer));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
  };
}

if (typeof (globalThis as any).CompressionStream === 'undefined') {
  (globalThis as any).CompressionStream = class CompressionStream {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;

    constructor(_format: string) {
      const chunks: Uint8Array[] = [];

      this.writable = new WritableStream<Uint8Array>({
        write(chunk) {
          chunks.push(chunk);
        },
        close: () => {
          const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
          const combined = new Uint8Array(totalLength);
          let offset = 0;
          for (const c of chunks) {
            combined.set(c, offset);
            offset += c.length;
          }
          const compressed = zlib.gzipSync(combined);

          this.readable = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array(compressed));
              controller.close();
            },
          });
        },
      });

      // Инициализируем пустым потоком по умолчанию (перезапишется в close)
      this.readable = new ReadableStream<Uint8Array>();
    }
  };
}

if (typeof (globalThis as any).DecompressionStream === 'undefined') {
  (globalThis as any).DecompressionStream = class DecompressionStream {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;

    constructor(_format: string) {
      const chunks: Uint8Array[] = [];

      this.writable = new WritableStream<Uint8Array>({
        write(chunk) {
          chunks.push(chunk);
        },
        close: () => {
          const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
          const combined = new Uint8Array(totalLength);
          let offset = 0;
          for (const c of chunks) {
            combined.set(c, offset);
            offset += c.length;
          }
          const decompressed = zlib.gunzipSync(combined);

          this.readable = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array(decompressed));
              controller.close();
            },
          });
        },
      });

      this.readable = new ReadableStream<Uint8Array>();
    }
  };
}

// --- Заглушка консоли -------------------------------------------------

let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  consoleWarnSpy.mockRestore();
  consoleErrorSpy.mockRestore();
  consoleInfoSpy.mockRestore();
  consoleLogSpy.mockRestore();
});
