// src/services/telemetry/TelemetryService.ts

import type { TelemetryRecord, TelemetryRecordType, SessionStartData } from './types';
import { APP_VERSION, BUILD_HASH } from '@/version';

const BUFFER_MAX = 500;
const FLUSH_INTERVAL_MS = 30_000;
const FLUSH_AT_SIZE = 100;
const SID_KEY = 'telemetry:sid';
const ENDPOINT = '/api/telemetry';

class TelemetryService {
  private static instance: TelemetryService | null = null;

  private seq = 0;
  private buffer: TelemetryRecord[] = [];
  private sid = '';
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private sessionStartTs = 0;

  static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  get sessionId(): string {
    return this.sid;
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    let sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SID_KEY, sid);
    }
    this.sid = sid;
    this.sessionStartTs = Date.now();

    const data: SessionStartData = {
      sid: this.sid,
      appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown',
      buildHash: typeof BUILD_HASH !== 'undefined' ? BUILD_HASH : 'unknown',
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      memoryGB: (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? null,
      cores: navigator.hardwareConcurrency ?? null,
    };
    this.record('session_start', data as unknown as Record<string, unknown>);

    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  stop(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
    this.started = false;
  }

  record(type: TelemetryRecordType, data: Record<string, unknown>): void {
    if (!this.started) return;
    this.seq++;
    this.buffer.push({ seq: this.seq, t: Date.now(), type, data });
    if (this.buffer.length > BUFFER_MAX) this.buffer.shift();
    if (this.buffer.length >= FLUSH_AT_SIZE) this.flush();
  }

  event(name: string, data: Record<string, unknown> = {}): void {
    this.record('event', { name, ...data });
  }

  flush(): void {
    if (!this.started || this.buffer.length === 0) return;
    if (!this.sid) return;

    const batch = this.buffer;
    this.buffer = [];

    const body = batch.map((r) => JSON.stringify(r)).join('\n');

    // sendBeacon не поддерживает кастомные заголовки, поэтому передаем sid в query.
    const url = `${ENDPOINT}?sid=${encodeURIComponent(this.sid)}`;

    try {
      const ok = navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
      if (!ok) {
        this.buffer = [...batch, ...this.buffer].slice(-BUFFER_MAX);
      }
    } catch {
      this.buffer = [...batch, ...this.buffer].slice(-BUFFER_MAX);
    }
  }

  recordSessionEnd(reason: string, finalMemMB: number | null): void {
    if (!this.started) return;
    this.record('session_end', {
      durationMs: Date.now() - this.sessionStartTs,
      finalMemMB,
      reason,
    });
    this.flush();
  }
}

export const telemetry = TelemetryService.getInstance();
