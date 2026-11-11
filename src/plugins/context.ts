// src/plugins/context.ts

import { createPluginStorage } from './storage';
import { getPluginContextDeps } from './contextDeps';
import { modalService } from '@/services/ui/ModalService';
import { toastService } from '@/services/ui/ToastService';
import type { PluginContext } from './types';

const contexts = new Map<string, PluginContext>();

/**
 * Создаёт (или возвращает кешированный) контекст плагина.
 *
 * Writer и папка скачиваний берутся из `contextDeps`, а не импортируются
 * напрямую: это держит `plugins/*` свободным от зависимостей на `stores/*`
 * и `services/download/*` и не даёт графу импортов замкнуться в цикл.
 * Инициализация deps — в composition root (`main.ts`).
 */
export function createPluginContext(pluginId: string): PluginContext {
  const cached = contexts.get(pluginId);
  if (cached) return cached;

  const context: PluginContext = {
    writer: getPluginContextDeps().createWriter(),
    storage: createPluginStorage(pluginId),
    showModal: (options) => modalService.show(options),
    showToast: (message, type = 'info') => {
      toastService.show(message, type);
    },
    getDownloadDir: () => getPluginContextDeps().getDownloadDir(pluginId),
  };

  contexts.set(pluginId, context);
  return context;
}

export function resetPluginContext(pluginId: string): void {
  contexts.delete(pluginId);
}

export function resetAllPluginContexts(): void {
  contexts.clear();
}
