// src/services/metadata/MetadataWorkerService.ts

import type { TrackMetadata, ParsedId3 } from './types';
import type { WorkerOutput } from '@/workers/metadata.worker';
import { telemetry } from '@/services/telemetry';

interface QueueItem {
  file: File;
  resolve: (value: ParsedId3 | null) => void;
  startTs: number;
  sizeKB: number;
}

class MetadataWorkerService {
  private static instance: MetadataWorkerService | null = null;
  private worker: Worker | null = null;
  private queue: QueueItem[] = [];
  private isProcessing = false;

  static getInstance(): MetadataWorkerService {
    if (!MetadataWorkerService.instance) {
      MetadataWorkerService.instance = new MetadataWorkerService();
    }
    return MetadataWorkerService.instance;
  }

  private initWorker() {
    if (this.worker) return;
    try {
      this.worker = new Worker(new URL('../../workers/metadata.worker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (e: MessageEvent<WorkerOutput>) => {
        const current = this.queue.shift();
        if (!current) return;

        if (e.data.status === 'success') {
          if (e.data.data === null) {
            telemetry.event('metadata.worker.done', {
              ms: Math.round(performance.now() - current.startTs),
              sizeKB: current.sizeKB,
              hasId3: false,
              hasCover: false,
            });
            current.resolve(null);
          } else {
            const metadata = e.data.data;
            const coverBlob = e.data.coverBlob;
            telemetry.event('metadata.worker.done', {
              ms: Math.round(performance.now() - current.startTs),
              sizeKB: current.sizeKB,
              hasId3: metadata.hasId3Tags,
              hasCover: Boolean(coverBlob),
            });
            current.resolve({ metadata, coverBlob });
          }
        } else {
          console.warn('[metadata-worker] failed to parse:', e.data.message);
          telemetry.event('metadata.worker.error', {
            ms: Math.round(performance.now() - current.startTs),
            sizeKB: current.sizeKB,
            msg: e.data.message.slice(0, 200),
          });
          current.resolve(null);
        }

        this.isProcessing = false;
        this.processQueue();
      };

      this.worker.onerror = (err) => {
        const current = this.queue.shift();
        current?.resolve(null);
        console.error('[metadata-worker] critical error:', err);
        this.isProcessing = false;
        this.processQueue();
      };
    } catch (err) {
      console.error('[metadata-worker] failed to initialize', err);
    }
  }

  private processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.initWorker();

    if (!this.worker) {
      this.queue.forEach((q) => q.resolve(null));
      this.queue = [];
      return;
    }

    this.isProcessing = true;
    const current = this.queue[0];
    if (current) {
      this.worker.postMessage({ file: current.file });
    }
  }

  public async parse(file: File): Promise<ParsedId3 | null> {
    return new Promise((resolve) => {
      this.queue.push({
        file,
        resolve,
        startTs: performance.now(),
        sizeKB: Math.round(file.size / 1024),
      });
      this.processQueue();
    });
  }
}

export const metadataWorkerService = MetadataWorkerService.getInstance();

// Экспорт для совместимости
export type { TrackMetadata, ParsedId3 };
