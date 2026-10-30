// src/plugins/podcasts/index.ts

import type { LibrarySource, PluginContext, PluginSnapshot } from '../types';
import type { TrackSource } from '@/types/track';
import { PLUGIN_ID, PLUGIN_NAME, PLUGIN_ICON } from './constants';
import { getSubscriptions } from './PodcastStorage';

const podcastsPlugin: LibrarySource = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  icon: PLUGIN_ICON,
  canDownload: false,
  isAvailable: () => true,

  async connect(_context: PluginContext): Promise<void> {
    // Stateless
  },

  async load(_context: PluginContext): Promise<PluginSnapshot> {
    return { folders: [], tracks: [] };
  },

  async restoreFromCache(_context: PluginContext): Promise<PluginSnapshot | null> {
    const subs = await getSubscriptions();
    return subs.length > 0 ? { folders: [], tracks: [] } : null;
  },

  buildStreamUrl(source: TrackSource): string {
    if (source.kind !== 'streaming') {
      throw new Error('[podcasts] buildStreamUrl: source must be streaming');
    }
    return source.url;
  },

  async disconnect(_context: PluginContext): Promise<void> {
    // Stateless
  },
};

export default podcastsPlugin;
