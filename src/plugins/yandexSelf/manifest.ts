// src/plugins/yandexSelf/manifest.ts
import type { PluginManifest } from '../types'
import { yandexSelfService } from './YandexSelfService'
import { createLibraryWriter } from '@/stores/library'

export const manifest: PluginManifest = {
  id: 'yandex-self',
  name: 'Логии',
  icon: '🐹',
  version: '0.1.0',
  enabled: true,
  canDownload: true,
  requiresActivation: true,
  order: 100,
  entry: () => import('./index'),

  // 1. Описываем схему
  getSettings: () => ({
    sections: [
      {
        id: 'yandex-self-auth',
        title: 'Доступ к диску',
        description: 'Управление контекстом и паролем',
        fields: [
          {
            type: 'action',
            id: 'reset-context',
            label: 'Сменить контекст',
            description:
              'Сбросить текущий пароль и войти под другим. Библиотека этого плагина будет очищена.',
            variant: 'danger',
          },
        ],
      },
    ],
  }),

  // 2. Обрабатываем нажатие
  runSettingsAction: async (actionId: string) => {
    if (actionId === 'reset-context') {
      if (
        !window.confirm(
          'Сбросить доступ? При следующем заходе потребуется ввести пароль (или контекст:пароль).',
        )
      ) {
        return
      }

      // Сбрасываем токен в сервисе
      yandexSelfService.logout()

      // Очищаем данные плагина в библиотеке
      const writer = createLibraryWriter()
      writer.removeBySource('yandex-self')

      // Перезагружаем страницу, чтобы HomeView заново инициализировал плагин
      window.location.href = '/'
    }
  },
}
