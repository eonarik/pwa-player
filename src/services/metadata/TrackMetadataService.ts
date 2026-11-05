// src/services/metadata/TrackMetadataService.ts

const PROXY_URL = '';
const REQUEST_TIMEOUT_MS = 10_000;

export interface RemoteMetadataCandidate {
  artist: string;
  title: string;
  album: string;
  coverUrl: string | null;
  source: string;
  similarity: number;
}

export interface RemoteTrackMetadata {
  artist: string;
  title: string;
  album: string;
  coverUrl: string | null;
  source: string;
  similarity: number;
  confident: boolean;
  candidates?: RemoteMetadataCandidate[];
}

export type MetadataFetchResult =
  | { status: 'found'; data: RemoteTrackMetadata }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'aborted' };

interface RawResponse {
  artist: string;
  title: string;
  album: string;
  coverUrl: string | null;
  source: string;
  similarity: number;
  confident: boolean;
  candidates?: RemoteMetadataCandidate[];
}

class TrackMetadataService {
  private static instance: TrackMetadataService | null = null;

  static getInstance(): TrackMetadataService {
    if (!TrackMetadataService.instance) {
      TrackMetadataService.instance = new TrackMetadataService();
    }
    return TrackMetadataService.instance;
  }

  async fetchItunes(
    artist: string,
    title: string,
    threshold: number,
    signal?: AbortSignal,
  ): Promise<MetadataFetchResult> {
    return this.fetchByProvider(artist, title, threshold, 'itunes', signal);
  }

  async fetchDeezer(
    artist: string,
    title: string,
    threshold: number,
    signal?: AbortSignal,
  ): Promise<MetadataFetchResult> {
    return this.fetchByProvider(artist, title, threshold, 'deezer', signal);
  }

  private async fetchByProvider(
    artist: string,
    title: string,
    threshold: number,
    provider: 'itunes' | 'deezer',
    signal?: AbortSignal,
  ): Promise<MetadataFetchResult> {
    if (!title) return { status: 'not-found' };

    try {
      const params = new URLSearchParams({
        title,
        threshold: String(threshold),
      });
      if (artist) params.set('artist', artist);

      const res = await fetch(`${PROXY_URL}/api/track-metadata?${params.toString()}`, {
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
          : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (signal?.aborted) return { status: 'aborted' };
      if (res.status >= 400 && res.status < 500) return { status: 'not-found' };
      if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` };

      const data = (await res.json()) as RawResponse | null;
      if (!data) return { status: 'not-found' };

      // Best-match от этого провайдера?
      const bestFromProvider = data.source === provider;

      // Кандидаты от этого провайдера (если бэкенд вернул массив).
      const providerCandidates = (data.candidates ?? []).filter((c) => c.source === provider);

      if (!bestFromProvider && providerCandidates.length === 0) {
        return { status: 'not-found' };
      }

      // Если best-match — от другого провайдера, но у нас есть свои кандидаты,
      // берём лучшего из своих (первый по порядку — бэкенд уже отсортировал по similarity).
      if (!bestFromProvider && providerCandidates.length > 0) {
        const best = providerCandidates[0]!;
        return {
          status: 'found',
          data: {
            artist: best.artist,
            title: best.title,
            album: best.album,
            coverUrl: best.coverUrl,
            source: best.source,
            similarity: best.similarity,
            confident: best.similarity >= threshold,
          },
        };
      }

      return {
        status: 'found',
        data: {
          artist: data.artist,
          title: data.title,
          album: data.album,
          coverUrl: data.coverUrl,
          source: data.source,
          similarity: data.similarity,
          confident: data.confident,
          candidates: providerCandidates.length > 0 ? providerCandidates : undefined,
        },
      };
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
