// src/plugins/demo/extension.ts
import type { PluginExtension } from '../types'
import IconSettings from '@/components/icons/IconSettings.vue'

export default {
  menuItems: [
    {
      id: 'demo-page',
      label: 'Демо-страница',
      icon: IconSettings, // Используем любую существующую иконку
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
