// src/services/telemetry/counters.ts

import type { CountersSnapshot } from './types';

/**
 * Глобальные счётчики ресурсов.
 * Инкрементируются патчами (patches.ts), читаются сэмплером (sampler.ts).
 */
const counters = {
  blobsCreated: 0,
  blobsRevoked: 0,
  timersActive: 0,
  listenersActive: 0,
  rafActive: 0,
};

export function incBlobsCreated(): void {
  counters.blobsCreated++;
}

export function incBlobsRevoked(): void {
  counters.blobsRevoked++;
}

export function incTimers(): void {
  counters.timersActive++;
}

export function decTimers(): void {
  if (counters.timersActive > 0) counters.timersActive--;
}

export function incListeners(): void {
  counters.listenersActive++;
}

export function decListeners(): void {
  if (counters.listenersActive > 0) counters.listenersActive--;
}

export function incRaf(): void {
  counters.rafActive++;
}

export function decRaf(): void {
  if (counters.rafActive > 0) counters.rafActive--;
}

export function getCountersSnapshot(): CountersSnapshot {
  return {
    blobsActive: Math.max(0, counters.blobsCreated - counters.blobsRevoked),
    timersActive: counters.timersActive,
    listenersActive: counters.listenersActive,
    rafActive: counters.rafActive,
  };
}
