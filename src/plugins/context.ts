// src/plugins/context.ts

import { createPluginStorage } from './storage'
import { createLibraryWriter } from '@/stores/library'
import { modalService } from '@/services/ui/ModalService'
import { toastService } from '@/services/ui/ToastService'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import type { PluginContext } from './types'

const contexts = new Map<string, PluginContext>()

export function createPluginContext(pluginId: string): PluginContext {
  const cached = contexts.get(pluginId)
  if (cached) return cached

  const context: PluginContext = {
    writer: createLibraryWriter(),
    storage: createPluginStorage(pluginId),
    showModal: (options) => modalService.show(options),
    showToast: (message, type = 'info') => {
      toastService.show(message, type)
    },
    proxyUrl: import.meta.env.VITE_DISK_PROXY_URL ?? '',
    getDownloadDir: async () => {
      if (!downloadSpaceService.hasSpace.value) return null
      return downloadSpaceService.getPluginDir(pluginId)
    },
  }

  contexts.set(pluginId, context)
  return context
}

export function resetPluginContext(pluginId: string): void {
  contexts.delete(pluginId)
}

export function resetAllPluginContexts(): void {
  contexts.clear()
}
