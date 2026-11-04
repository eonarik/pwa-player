// src/services/telemetry/types.ts

export type TelemetryRecordType = 'session_start' | 'snapshot' | 'event' | 'error' | 'session_end';

export interface TelemetryRecord {
  /** Порядковый номер записи в сессии */
  seq: number;
  /** Unix ms */
  t: number;
  type: TelemetryRecordType;
  data: Record<string, unknown>;
}

export interface SessionStartData {
  sid: string;
  appVersion: string;
  buildHash: string;
  ua: string;
  memoryGB: number | null;
  cores: number | null;
}

export interface MemorySnapshot {
  usedMB: number | null;
  limitMB: number | null;
}

export interface CountersSnapshot {
  blobsActive: number;
  timersActive: number;
  listenersActive: number;
  rafActive: number;
}

export interface CountsSnapshot {
  tracks: number;
  folders: number;
  albums: number;
  queue: number;
  metaCache: number;
  folderStatusEntries: number;
}

export interface StorageSnapshot {
  usageMB: number | null;
  quotaMB: number | null;
}

export interface SnapshotData {
  mem: MemorySnapshot;
  counters: CountersSnapshot;
  counts: CountsSnapshot;
  storage: StorageSnapshot;
}

export interface EventData {
  name: string;
  [key: string]: unknown;
}

export interface ErrorData {
  kind: 'unhandledrejection' | 'window.error' | 'audio.error' | 'network.error';
  msg: string;
  stack?: string;
}

export interface SessionEndData {
  durationMs: number;
  finalMemMB: number | null;
  reason: string;
}
