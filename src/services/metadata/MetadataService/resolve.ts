// src/services/metadata/MetadataService/resolve.ts

import { loadPlugin } from '@/plugins/registry';
import { getPlugins } from '@/plugins/registry';
import { trackMetadataService } from '../TrackMetadataService';
import type { MetadataCandidate } from '@/types/metadata';
import { newMetadataCandidateId } from '@/types/ids';
import type { ResolveMode, ResolveResult, RemoteResult, ResolvedCandidate } from './types';
import { isBuiltinMetadataProvider, type BuiltinMetadataProviderId } from './constants';
import { useUiSettingsStore } from '@/stores/uiSettings';

export function createMetadataResolve() {
  async function resolveCandidates(
    artist: string,
    title: string,
    mode: ResolveMode,
    threshold: number,
    signal?: AbortSignal,
  ): Promise<ResolveResult> {
    if (signal?.aborted) return { status: 'aborted' };

    if (mode === 'sequential') {
      return resolveSequential(artist, title, threshold, signal);
    }
    return resolveParallel(artist, title, threshold, signal);
  }

  function getEnabledProviders(): { id: string; isPlugin: boolean }[] {
    const ui = useUiSettingsStore();
    const availablePlugins = new Set(
      getPlugins()
        .filter((m) => m.metadataPriority !== undefined)
        .map((m) => m.id),
    );

    const result: { id: string; isPlugin: boolean }[] = [];
    for (const id of ui.metadataProviderOrder) {
      if (!ui.isMetadataProviderEnabled(id)) continue;
      if (isBuiltinMetadataProvider(id)) {
        result.push({ id, isPlugin: false });
      } else if (availablePlugins.has(id)) {
        result.push({ id, isPlugin: true });
      }
    }
    return result;
  }

  async function tryProvider(
    providerId: string,
    isPlugin: boolean,
    artist: string,
    title: string,
    threshold: number,
    signal?: AbortSignal,
  ): Promise<RemoteResult> {
    if (!isPlugin && isBuiltinMetadataProvider(providerId)) {
      const builtin = providerId as BuiltinMetadataProviderId;
      const result =
        builtin === 'itunes'
          ? await trackMetadataService.fetchItunes(artist, title, threshold, signal)
          : await trackMetadataService.fetchDeezer(artist, title, threshold, signal);

      if (result.status === 'aborted') return { status: 'aborted' };
      if (result.status === 'error') return { status: 'error', message: result.message };
      if (result.status === 'not-found') return { status: 'not-found' };

      const data = result.data;
      const candidate: ResolvedCandidate = {
        artist: data.artist,
        title: data.title,
        album: data.album,
        coverUrl: data.coverUrl,
        similarity: data.similarity,
        provider: data.source,
        confident: data.confident,
      };
      return { status: 'ok', candidates: [candidate] };
    }

    // Плагин
    try {
      const plugin = await loadPlugin(providerId);
      if (!plugin.fetchMetadata) return { status: 'not-found' };
      const data = await plugin.fetchMetadata(artist, title);
      if (!data) return { status: 'not-found' };
      const candidate: ResolvedCandidate = {
        artist: data.artist,
        title: data.title,
        album: data.album,
        coverUrl: data.coverUrl,
        similarity: data.similarity,
        provider: providerId,
        confident: data.confident,
        extMetadata: data.extMetadata,
      };
      return { status: 'ok', candidates: [candidate] };
    } catch (err) {
      return { status: 'error', message: err instanceof Error ? err.message : 'Unknown plugin error' };
    }
  }

  async function resolveSequential(
    artist: string,
    title: string,
    threshold: number,
    signal?: AbortSignal,
  ): Promise<ResolveResult> {
    const order = getEnabledProviders();
    if (order.length === 0) return { status: 'not-found' };

    const collected: ResolvedCandidate[] = [];

    for (const provider of order) {
      if (signal?.aborted) return { status: 'aborted' };

      const result = await tryProvider(provider.id, provider.isPlugin, artist, title, threshold, signal);
      if (result.status === 'aborted') return { status: 'aborted' };
      if (result.status === 'error') {
        console.warn(`[metadata] provider "${provider.id}" failed: ${result.message}`);
        continue;
      }
      if (result.status === 'not-found') continue;

      const confident = result.candidates.find((c) => c.confident && c.similarity >= threshold);
      if (confident) return { status: 'confident', candidate: confident };

      collected.push(...result.candidates.filter((c) => c.similarity >= threshold));
    }

    if (collected.length === 0) return { status: 'not-found' };
    collected.sort((a, b) => b.similarity - a.similarity);
    return { status: 'candidates', candidates: collected };
  }

  async function resolveParallel(
    artist: string,
    title: string,
    threshold: number,
    signal?: AbortSignal,
  ): Promise<ResolveResult> {
    const order = getEnabledProviders();
    if (order.length === 0) return { status: 'not-found' };

    const tasks = order.map((provider) =>
      tryProvider(provider.id, provider.isPlugin, artist, title, threshold, signal),
    );

    const results = await Promise.all(tasks);
    if (signal?.aborted) return { status: 'aborted' };

    const collected: ResolvedCandidate[] = [];
    for (const result of results) {
      if (result.status === 'error') {
        console.warn(`[metadata] parallel provider failed: ${result.message}`);
        continue;
      }
      if (result.status === 'not-found') continue;
      if (result.status === 'aborted') return { status: 'aborted' };
      collected.push(...result.candidates.filter((c) => c.similarity >= threshold));
    }

    if (collected.length === 0) return { status: 'not-found' };

    collected.sort((a, b) => {
      const aConf = a.confident;
      const bConf = b.confident;
      if (aConf && !bConf) return -1;
      if (!aConf && bConf) return 1;
      return b.similarity - a.similarity;
    });

    const first = collected[0]!;
    if (first.confident) return { status: 'confident', candidate: first };
    return { status: 'candidates', candidates: collected };
  }

  function toCandidate(c: ResolvedCandidate): MetadataCandidate {
    return {
      id: newMetadataCandidateId(),
      artist: c.artist,
      title: c.title,
      album: c.album,
      coverUrl: c.coverUrl,
      similarity: c.similarity,
      provider: c.provider,
      extMetadata: c.extMetadata,
    };
  }

  return {
    resolveCandidates,
    toCandidate,
  };
}

export type MetadataResolve = ReturnType<typeof createMetadataResolve>;
