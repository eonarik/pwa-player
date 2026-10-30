// src/plugins/zvuk/manifest.ts

import type { PluginManifest } from '../types';
import zvukIcon from '@/assets/sber-zvuk.png';

export const manifest: PluginManifest = {
  id: 'zvuk',
  name: 'СберЗвук',
  icon: zvukIcon,
  version: '0.1.0',
  enabled: true,
  canDownload: false,
  isStateless: true,
  isStreaming: true,
  customRoute: 'zvuk',
  order: 40,
  sourcePriority: 30,
  entry: () => import('./index'),
  extension: () => import('./extension'),

  getSettings: () => {
    // Проверяем глобальную настройку, чтобы дать пользователю контекст
    let globalAutoFetch = true;
    try {
      const uiSettings = JSON.parse(localStorage.getItem('player:uiSettings') || '{}');
      if (uiSettings.autoFetchMetadata === false) globalAutoFetch = false;
    } catch {}

    return {
      sections: [
        {
          id: 'zvuk-metadata',
          title: 'Метаданные',
          description: globalAutoFetch
            ? 'СберЗвук будет использоваться как один из источников при автопоиске обложек и альбомов для всей библиотеки.'
            : 'Глобальный автопоиск метаданных выключен. Включите его в общих настройках, чтобы использовать СберЗвук.',
          fields: [
            {
              type: 'toggle',
              id: 'fetchMetadataFromZvuk',
              label: 'Искать метаданные в СберЗвуке',
              value: localStorage.getItem('zvuk:fetchMetadata') !== 'false',
              description: 'Помогает находить обложки и альбомы для локальных и облачных треков',
            },
          ],
        },
      ],
    };
  },

  runSettingsAction: async (actionId: string, payload?: unknown) => {
    if (actionId === 'fetchMetadataFromZvuk') {
      localStorage.setItem('zvuk:fetchMetadata', String(payload));
    }
  },
};
