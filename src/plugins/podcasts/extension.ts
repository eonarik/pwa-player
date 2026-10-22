// src/plugins/podcasts/extension.ts

import type { PluginExtension } from '../types'

export default {
  routes: [
    {
      path: '/podcasts',
      name: 'podcasts',
      component: () => import('./PodcastsView.vue'),
    },
    {
      path: '/podcasts/catalog',
      name: 'podcasts-catalog',
      component: () => import('./PodcastCatalog.vue'),
    },
    {
      path: '/podcasts/:feedUrl',
      name: 'podcast-detail',
      component: () => import('./PodcastRoute.vue'),
      props: true,
    },
  ],
} satisfies PluginExtension
