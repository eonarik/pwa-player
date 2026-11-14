// src/plugins/searchStreams.ts

import { getPlugins, isPluginActivated, loadPlugin } from './registry';
import type { SearchCandidate } from './types';
import { logger } from '@/utils/logger';

export interface SearchStreamsResult {
  pluginId: string;
  pluginName: string;
  candidates: SearchCandidate[];
  error?: string;
}

/**
 * Ищет треки во всех активных плагинах, реализующих `searchTracks`.
 * Ядро не знает конкретных плагинов — опрашивает реестр по контракту.
 * Ошибка одного плагина не прерывает поиск в остальных.
 */
export async function searchStreams(query: string): Promise<SearchStreamsResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const plugins = getPlugins().filter((m) => m.enabled && isPluginActivated(m.id) && m.isStreaming);

  const results = await Promise.all(
    plugins.map(async (manifest): Promise<SearchStreamsResult | null> => {
      try {
        const source = await loadPlugin(manifest.id);
        if (!source.searchTracks) return null;

        const candidates = await source.searchTracks(trimmed);
        return {
          pluginId: manifest.id,
          pluginName: manifest.name,
          candidates,
        };
      } catch (err) {
        logger.warn(`[searchStreams] ${manifest.id} failed`, err);
        return {
          pluginId: manifest.id,
          pluginName: manifest.name,
          candidates: [],
          error: err instanceof Error ? err.message : 'Search failed',
        };
      }
    }),
  );

  return results.filter((r): r is SearchStreamsResult => r !== null);
}

/**
 * Скачивает физический звук кандидата через контракт `fetchAudioBlob`.
 */
export async function fetchCandidateAudio(candidate: SearchCandidate): Promise<Blob | null> {
  const source = await loadPlugin(candidate.pluginId);
  if (!source.fetchAudioBlob) {
    throw new Error(`Плагин ${candidate.pluginId} не поддерживает скачивание`);
  }
  return source.fetchAudioBlob(candidate);
}

/**
 * Имя файла для переноса кандидата в файловый плагин (Логии).
 * Формат: "{artist} - {title}.mp3" с санитизацией и дедупом.
 */
export function candidateFileName(candidate: SearchCandidate, takenNames: Set<string>): string {
  const sanitize = (s: string): string =>
    s
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const artist = sanitize(candidate.artist) || 'Unknown';
  const title = sanitize(candidate.title) || 'Track';
  const base = `${artist} - ${title}`;

  if (!takenNames.has(`${base}.mp3`)) return `${base}.mp3`;

  for (let i = 2; i < 100; i++) {
    const name = `${base}-${i}.mp3`;
    if (!takenNames.has(name)) return name;
  }

  return `${base}-${Date.now()}.mp3`;
}