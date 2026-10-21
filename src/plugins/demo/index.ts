// src/plugins/demo/index.ts
import type { LibrarySource } from '../types'

const demoPlugin: LibrarySource = {
  id: 'demo',
  name: 'Демо',
  icon: '🧪',
  isAvailable: () => true,
  connect: async () => {},
  load: async () => {},
  restoreFromCache: async () => false,
  buildStreamUrl: () => '',
  canDownload: false,
  disconnect: async () => {},
}

export default demoPlugin
