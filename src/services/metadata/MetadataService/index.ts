// src/services/metadata/MetadataService/index.ts

import { createMetadataPersistence } from './persistence';
import { createMetadataResolve } from './resolve';
import { createMetadataApply } from './apply';
import { createMetadataReset } from './reset';
import { createMetadataFetch } from './fetch';
import type { TrackId } from '@/types/ids';
import type { MetadataCandidate } from '@/types/metadata';
import type { TrackMetadata } from '../types';
import type { RemoteTrackMetadata } from '../TrackMetadataService';
import type { ApplyResult, ManualPatch, FetchResult } from './types';

export type { ApplyResult, ManualPatch, FetchResult } from './types';

export class MetadataService {
  private static instance: MetadataService | null = null;

  private persistenceMod = createMetadataPersistence();
  private resolveMod = createMetadataResolve();
  private applyMod = createMetadataApply(this.persistenceMod);
  private resetMod = createMetadataReset(this.persistenceMod);
  private fetchMod = createMetadataFetch(this.persistenceMod, this.resolveMod, this.applyMod);

  static getInstance(): MetadataService {
    if (!MetadataService.instance) {
      MetadataService.instance = new MetadataService();
    }
    return MetadataService.instance;
  }

  // --- Публичный API (тонкие прокси) ---

  fetchAndApply(trackId: TrackId, signal?: AbortSignal, force = false): Promise<FetchResult> {
    return this.fetchMod.fetchAndApply(trackId, signal, force);
  }

  fetchCandidates(trackId: TrackId): Promise<MetadataCandidate[]> {
    return this.fetchMod.fetchCandidates(trackId);
  }

  applyRemote(trackId: TrackId, incoming: RemoteTrackMetadata): ApplyResult {
    return this.applyMod.applyRemote(trackId, incoming);
  }

  applyFromFile(trackId: TrackId, parsed: TrackMetadata): void {
    this.applyMod.applyFromFile(trackId, parsed);
  }

  updateManual(trackId: TrackId, patch: ManualPatch): void {
    this.applyMod.updateManual(trackId, patch);
  }

  applyCandidate(trackId: TrackId, candidate: MetadataCandidate): Promise<void> {
    return this.applyMod.applyCandidate(trackId, candidate);
  }

  reset(trackId: TrackId): Promise<void> {
    return this.resetMod.reset(trackId);
  }

  resetMany(trackIds: TrackId[]): Promise<void> {
    return this.resetMod.resetMany(trackIds);
  }

  flush(): Promise<void> {
    return this.persistenceMod.flush();
  }

  hasEntry(trackId: TrackId): boolean {
    return this.persistenceMod.hasEntry(trackId);
  }

  getEntry(trackId: TrackId) {
    return this.persistenceMod.getEntry(trackId);
  }

  markNotFound(trackId: TrackId): void {
    this.persistenceMod.markNotFound(trackId);
  }
}

export const metadataService = MetadataService.getInstance();
