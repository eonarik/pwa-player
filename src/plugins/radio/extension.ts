// src/plugins/radio/extension.ts

import type { PluginExtension } from '../types';

export default {
  routes: [
    {
      path: '/radio',
      name: 'radio',
      component: () => import('./RadioView.vue'),
    },
  ],
} satisfies PluginExtension;
