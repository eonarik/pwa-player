// src/plugins/demo/extension.ts
import type { PluginExtension } from '../types'

export default {
  menuItems: [
    {
      id: 'demo-page',
      label: 'Демо-страница',
      icon: 'settings', // или любая другая из реестра ICONS
      routeName: 'demo',
    },
  ],
  routes: [
    {
      path: '/demo',
      name: 'demo',
      component: () => import('./DemoView.vue'),
    },
  ],
} satisfies PluginExtension
