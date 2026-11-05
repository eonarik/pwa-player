// src/plugins/yandexSelf/extension.ts

import type { PluginExtension } from '../types';

export default {
  folderViews: [
    {
      pluginId: 'yandex-self',
      // любой путь, содержащий logii.<season> (с опциональными author/folder/track)
      match: (urlPath: string) => /(?:^|\/)logii\.[^/]+(?:\/[^/]+){0,3}\/?$/.test(urlPath),
      component: () => import('./logii/LogiiView.vue'),
      props: (urlPath: string) => ({ urlPath }),
    },
  ],
} satisfies PluginExtension;
