// src/services/telemetry/sampler.ts

import { telemetry } from './TelemetryService';
import { getCountersSnapshot } from './counters';
import type { SnapshotData } from './types';

const SAMPLE_INTERVAL_MS = 30_000;

interface PerfMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

function getMemory(): { usedMB: number | null; limitMB: number | null } {
  const perf = performance as Performance & { memory?: PerfMemory };
  if (!perf.memory) return { usedMB: null, limitMB: null };
  return {
    usedMB: Math.round(perf.memory.usedJSHeapSize / 1024 / 1024),
    limitMB: Math.round(perf.memory.jsHeapSizeLimit / 1024 / 1024),
  };
}

function getDomNodes(): number {
  try {
    return document.querySelectorAll('*').length;
  } catch {
    return -1;
  }
}

async function getStorage(): Promise<{ usageMB: number | null; quotaMB: number | null }> {
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return {
        usageMB: est.usage !== undefined ? Math.round(est.usage / 1024 / 1024) : null,
        quotaMB: est.quota !== undefined ? Math.round(est.quota / 1024 / 1024) : null,
      };
    }
  } catch {
    // ignore
  }
  return { usageMB: null, quotaMB: null };
}

async function getCounts(): Promise<{
  tracks: number;
  folders: number;
  albums: number;
  queue: number;
  metaCache: number;
  folderStatusEntries: number;
}> {
  try {
    const [{ useLibraryStore }, { usePlayerStore }, { metadataPersistenceService }] = await Promise.all([
      import('@/stores/library'),
      import('@/stores/player'),
      import('@/services/persistence/MetadataPersistenceService'),
    ]);

    const library = useLibraryStore();
    const player = usePlayerStore();

    return {
      tracks: Object.keys(library.tracks).length,
      folders: Object.keys(library.folders).length,
      albums: Object.keys(library.albums).length,
      queue: player.queue.length,
      metaCache: metadataPersistenceService.size(),
      folderStatusEntries: 0,
    };
  } catch {
    return { tracks: 0, folders: 0, albums: 0, queue: 0, metaCache: 0, folderStatusEntries: 0 };
  }
}

async function takeSnapshot(): Promise<void> {
  const mem = getMemory();
  const storage = await getStorage();
  const counts = await getCounts();

  const data: SnapshotData = {
    mem,
    counters: getCountersSnapshot(),
    counts,
    storage,
  };

  (data.counters as unknown as { domNodes: number }).domNodes = getDomNodes();

  telemetry.record('snapshot', data as unknown as Record<string, unknown>);
}

export function startSampler(): () => void {
  void takeSnapshot();

  const timer = setInterval(() => void takeSnapshot(), SAMPLE_INTERVAL_MS);
  return () => clearInterval(timer);
}
