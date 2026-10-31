// src/plugins/zvuk/extension.ts

import type { PluginExtension } from '../types';
import { restoreUnavailableTracksInZvuk } from './restoreUnavailable';

export default {
  routes: [
    {
      path: '/zvuk',
      name: 'zvuk',
      component: () => import('./ZvukView.vue'),
    },
  ],
  collectionActions: [
    {
      id: 'zvuk-restore-unavailable',
      label: 'Найти в Звуке',
      icon: 'search',
      tooltip: 'Найти источники для недоступных треков',
      shouldShow: (tracks) => tracks.some((t) => t.sources.length === 0),
      run: async (tracks, ctx) => {
        await restoreUnavailableTracksInZvuk(tracks, ctx);
      },
    },
  ],
} satisfies PluginExtension;
