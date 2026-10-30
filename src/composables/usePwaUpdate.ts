// src/composables/usePwaUpdate.ts

import { watch } from 'vue';
import { pwaService } from '@/services/pwa/PwaService';
import { toastService } from '@/services/ui/ToastService';

/**
 * Инициализирует PWA-обновления и показывает тост «Доступно обновление»
 * с кнопкой «Перезагрузить». Вызывать один раз в App.vue.
 */
export function usePwaUpdate(): void {
  pwaService.init();

  watch(
    pwaService.needRefresh,
    (need) => {
      if (!need) return;
      toastService.showPersistent('Доступно обновление', 'info', {
        label: 'Перезагрузить',
        onAction: () => {
          void pwaService.applyUpdate();
        },
      });
    },
    { immediate: true },
  );
}
