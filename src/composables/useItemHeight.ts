// src/composables/useItemHeight.ts

import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue'

/**
 * Измеряет высоту элемента через ResizeObserver.
 * Возвращает ref с высотой в пикселях.
 *
 * Почему ResizeObserver, а не getBoundingClientRect:
 * - Реагирует на изменения дизайна (шрифты, темы, media queries)
 * - Реагирует на изменение размера окна
 * - Не требует ручного пересчёта после mount
 */
export function useItemHeight(elRef: Ref<HTMLElement | null>) {
  const height = ref(0)
  let observer: ResizeObserver | null = null
  let observedEl: HTMLElement | null = null

  function attach(el: HTMLElement | null) {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    observedEl = el
    if (!el) return

    observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      // contentRect.height — без border.
      // Если нужна высота с border — используй borderBoxSize
      height.value = entry.contentRect.height
    })
    observer.observe(el)
  }

  onMounted(() => attach(elRef.value))

  // Если ref меняется (v-if переключился) — перепривязываем
  watch(elRef, (el) => attach(el))

  onUnmounted(() => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    observedEl = null
  })

  return height
}
