// src/plugins/demo/manifest.ts
import type { PluginManifest } from '../types'

export const manifest: PluginManifest = {
  id: 'demo',
  name: 'Демо-плагин',
  icon: '🧪',
  version: '1.0.0',
  enabled: false,
  canDownload: false,

  // Обязательное поле по контракту, но для расширения оно нам не нужно.
  // Возвращаем пустышку, чтобы не падало, если кто-то вызовет loadPlugin.
  entry: () => import('./index'),

  // Вот тут наше расширение
  extension: () => import('./extension'),
}
