// src/plugins/context.ts

import { createPluginStorage } from './storage'
import { createLibraryWriter } from '@/stores/library'
import { modalService } from '@/services/ui/ModalService'
import type { PluginContext } from './types'

const contexts = new Map<string, PluginContext>()

function createToastStub(): PluginContext['showToast'] {
  return () => {
    console.warn('[plugins] showToast stub called (not implemented yet)')
  }
}

function createFetchCoverStub(): PluginContext['fetchCover'] {
  return async () => null
}

export function createPluginContext(pluginId: string): PluginContext {
  const cached = contexts.get(pluginId)
  if (cached) return cached

  const context: PluginContext = {
    writer: createLibraryWriter(),
    storage: createPluginStorage(pluginId),
    showModal: (options) => modalService.show(options),
    showToast: createToastStub(),
    fetchCover: createFetchCoverStub(),
    proxyUrl: import.meta.env.VITE_DISK_PROXY_URL ?? '',
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
