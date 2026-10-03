// src/composables/useDominantColor.ts

import { ref, watch, type Ref } from 'vue'
import { extractDominantColor, FALLBACK_RGB, type Rgb } from '@/utils/dominantColor'

/**
 * Реактивно извлекает доминирующий цвет из src.
 * Пока цвет не готов (или не extracted) — возвращает FALLBACK_RGB.
 * Отменяет устаревшие запросы через счётчик-токен.
 */
export function useDominantColor(src: Ref<string | null | undefined>): Ref<Rgb> {
  const color = ref<Rgb>(FALLBACK_RGB)
  let requestToken = 0

  watch(
    src,
    async (value) => {
      if (!value) {
        color.value = FALLBACK_RGB
        return
      }

      const token = ++requestToken

      try {
        const extracted = await extractDominantColor(value)
        // Пока грузили — src мог смениться; отбрасываем устаревшее
        if (token !== requestToken) return
        color.value = extracted ?? FALLBACK_RGB
      } catch (err) {
        // extractDominantColor не должен бросать, но на всякий случай
        if (token !== requestToken) return
        console.warn('[useDominantColor] extract failed', err)
        color.value = FALLBACK_RGB
      }
    },
    { immediate: true },
  )

  return color
}
