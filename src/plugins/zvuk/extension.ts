// src/plugins/zvuk/extension.ts

import type { PluginExtension } from '../types';

export default {
  routes: [
    {
      path: '/zvuk',
      name: 'zvuk',
      component: () => import('./ZvukView.vue'),
    },
  ],
} satisfies PluginExtension;
