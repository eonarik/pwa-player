// src/services/metadata/MetadataWorkerService.ts

import type { TrackMetadata } from './types';
import type { WorkerOutput } from '@/workers/metadata.worker';

class MetadataWorkerService {
  private static instance: MetadataWorkerService | null = null;
  private worker: Worker | null = null;
  private queue: Array<{ file: File; resolve: (v: TrackMetadata | null) => void }> = [];
  private isProcessing = false;

  static getInstance(): MetadataWorkerService {
    if (!MetadataWorkerService.instance) {
      MetadataWorkerService.instance = new MetadataWorkerService();
    }
    return MetadataWorkerService.instance;
  }

  private initWorker() {
    if (this.worker) return;
    console.log('[metadata-worker] initializing worker...');

    try {
      this.worker = new Worker(new URL('../../workers/metadata.worker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (e: MessageEvent<WorkerOutput>) => {
        const current = this.queue.shift();
        if (!current) return;

        if (e.data.status === 'success') {
          current.resolve(e.data.data);
        } else {
          console.warn('[metadata-worker] failed to parse:', e.data.message);
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

  public async parse(file: File): Promise<TrackMetadata | null> {
    return new Promise((resolve) => {
      this.queue.push({ file, resolve });
      this.processQueue();
    });
  }
}

export const metadataWorkerService = MetadataWorkerService.getInstance();
