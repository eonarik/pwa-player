// src/plugins/remoteLoader.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadRemote } from '@module-federation/enhanced/runtime'
import type { PluginManifest } from './types'

export async function loadRemotePlugins(): Promise<PluginManifest[]> {
  const remotePlugins: PluginManifest[] = []

  try {
    // Загружаем экспорт './manifest' из remote 'logii'
    const logiiModule = await loadRemote<any>('logii/manifest')

    // Извлекаем сам манифест (в зависимости от того, как он экспортируется в src/manifest.ts)
    const manifest = logiiModule.default || logiiModule.manifest || logiiModule

    if (manifest && manifest.id) {
      remotePlugins.push(manifest as PluginManifest)
      console.log('[federation] Логии успешно загружен')
    }
  } catch (err) {
    console.warn('[federation] Не удалось загрузить logii', err)
  }

  return remotePlugins
}
