// src/services/metadata/TrackMetadataService.ts

import type { MetadataCandidate } from '@/types/metadata';

const PROXY_URL = '';
const REQUEST_TIMEOUT_MS = 10_000;

export interface RemoteTrackMetadata {
  artist: string;
  title: string;
  album: string;
  coverUrl: string | null;
  source: string;
  similarity: number;
  confident: boolean;
  candidates?: MetadataCandidate[];
}

export type MetadataFetchResult =
  | { status: 'found'; data: RemoteTrackMetadata }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'aborted' };

class TrackMetadataService {
  private static instance: TrackMetadataService | null = null;

  static getInstance(): TrackMetadataService {
    if (!TrackMetadataService.instance) {
      TrackMetadataService.instance = new TrackMetadataService();
    }
    return TrackMetadataService.instance;
  }

  async fetch(artist: string, title: string, threshold: number, signal?: AbortSignal): Promise<MetadataFetchResult> {
    if (!title) return { status: 'not-found' };

    try {
      const params = new URLSearchParams({
        title,
        threshold: String(threshold),
      });
      if (artist) {
        params.set('artist', artist);
      }

      const res = await fetch(`${PROXY_URL}/api/track-metadata?${params.toString()}`, {
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
          : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (signal?.aborted) return { status: 'aborted' };
      if (res.status >= 400 && res.status < 500) return { status: 'not-found' };
      if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` };

      const data = (await res.json()) as RemoteTrackMetadata | null;
      if (!data) return { status: 'not-found' };

      return { status: 'found', data };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { status: 'aborted' };
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { status: 'error', message };
    }
  }
}

export const trackMetadataService = TrackMetadataService.getInstance();
