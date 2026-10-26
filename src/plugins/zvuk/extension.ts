// src/plugins/zvuk/extension.ts
import type { PluginExtension } from '../types'

export default {
  routes: [
    {
      path: '/zvuk',
      name: 'zvuk',
      component: () => import('./ZvukView.vue'),
    },
  ],
  menuItems: [
    {
      id: 'zvuk',
      label: 'Звук',
      icon: 'music', // Убедись, что такая иконка есть в реестре (ICONS)
      routeName: 'zvuk',
    },
  ],
} satisfies PluginExtension
