// src/plugins/demo/index.ts

import type { LibrarySource, PluginContext, PluginSnapshot } from '../types';

const demoPlugin: LibrarySource = {
  id: 'demo',
  name: 'Демо',
  icon: '🧪',
  isAvailable: () => true,

  async connect(_context: PluginContext): Promise<void> {},
  async load(_context: PluginContext): Promise<PluginSnapshot> {
    return { folders: [], tracks: [] };
  },
  async restoreFromCache(_context: PluginContext): Promise<PluginSnapshot | null> {
    return null;
  },
  buildStreamUrl(): string {
    return '';
  },
  canDownload: false,
  async disconnect(_context: PluginContext): Promise<void> {},
};

export default demoPlugin;
