// src/plugins/zvuk/index.ts

import type { LibrarySource, PluginContext, PluginSnapshot } from '../types';
import type { TrackSource } from '@/types/track';

const zvukPlugin: LibrarySource = {
  id: 'zvuk',
  name: 'СберЗвук',
  icon: '🎵',
  canDownload: false,
  isAvailable: () => true,

  async connect(_context: PluginContext): Promise<void> {
    // Stateless
  },

  async load(_context: PluginContext): Promise<PluginSnapshot> {
    return { folders: [], tracks: [] };
  },

  async restoreFromCache(_context: PluginContext): Promise<PluginSnapshot | null> {
    return null;
  },

  buildStreamUrl(source: TrackSource): string {
    if (source.kind !== 'streaming') {
      throw new Error('[zvuk] buildStreamUrl: source must be streaming');
    }
    return source.url;
  },

  async disconnect(_context: PluginContext): Promise<void> {
    // Stateless
  },

  async fetchMetadata(artist: string, title: string) {
    try {
      const params = new URLSearchParams();
      if (artist) params.set('artist', artist);
      params.set('title', title);

      const res = await fetch(`/api/zvuk/metadata?${params.toString()}`);
      if (!res.ok) return null;

      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('[zvuk] failed to fetch metadata', err);
      return null;
    }
  },
};

export default zvukPlugin;
