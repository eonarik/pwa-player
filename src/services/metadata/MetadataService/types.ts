// src/services/metadata/MetadataService/types.ts

export type ApplyResult =
  { status: 'applied' } | { status: 'candidates' } | { status: 'skipped'; reason: 'not-found' | 'protected' };

export interface ManualPatch {
  artist: string;
  title: string;
  album: string;
  coverUrl: string | undefined;
}

export type FetchResult =
  | { status: 'applied' }
  | { status: 'candidates' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'aborted' }
  | { status: 'skipped'; reason: 'protected' | 'not-found' };

/** Единичный «сырой» кандидат от провайдера (до маппинга в MetadataCandidate). */
export interface ResolvedCandidate {
  artist: string;
  title: string;
  album: string;
  coverUrl: string | null;
  similarity: number;
  provider: string;
  confident: boolean;
  extMetadata?: Record<string, unknown>;
}

export type ResolveMode = 'sequential' | 'parallel';

export type ResolveResult =
  | { status: 'confident'; candidate: ResolvedCandidate }
  | { status: 'candidates'; candidates: ResolvedCandidate[] }
  | { status: 'not-found' }
  | { status: 'aborted' }
  | { status: 'error'; message: string };

export type RemoteResult =
  | { status: 'ok'; candidates: ResolvedCandidate[] }
  | { status: 'not-found' }
  | { status: 'aborted' }
  | { status: 'error'; message: string };
