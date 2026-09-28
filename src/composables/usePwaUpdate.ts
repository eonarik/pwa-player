// src/composables/usePwaUpdate.ts

import { watch } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { toastService } from '@/services/ui/ToastService'

/**
 * Проверяет наличие обновления PWA и показывает тост с кнопкой
 * «Перезагрузить». Пользователь сам решает, когда применить обновление —
 * чтобы не прерывать воспроизведение.
 */
export function usePwaUpdate(): void {
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      setInterval(
        () => {
          void registration.update()
        },
        60 * 60 * 1000,
      )
    },
    onRegisterError(error) {
      console.error('[pwa] register error', error)
    },
  })

  watch(
    needRefresh,
    (need) => {
      if (!need) return
      toastService.showPersistent('Доступно обновление', 'info', {
        label: 'Перезагрузить',
        onAction: () => {
          void updateServiceWorker(true)
        },
      })
    },
    { immediate: true },
  )
}
