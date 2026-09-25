// src/composables/useVirtualList.ts

import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  unref,
  watch,
  type Ref,
  type ComputedRef,
} from 'vue'

type MaybeRef<T> = T | Ref<T> | ComputedRef<T>

interface UseVirtualListOptions<T> {
  /** Исходный массив */
  items: Ref<T[]>
  /**
   * Высота одного элемента в пикселях.
   * Может быть числом (если высота фиксирована) или ref/computed,
   * если высота измеряется динамически через useItemHeight.
   */
  itemHeight: MaybeRef<number>
  /** Сколько элементов рендерить сверху/снизу за пределами видимой области */
  overscan?: number
  /** Ref на скролл-контейнер */
  containerRef: Ref<HTMLElement | null>
}

export function useVirtualList<T>(options: UseVirtualListOptions<T>) {
  const { items, itemHeight, overscan = 5, containerRef } = options

  /** Высота видимой области */
  const viewportHeight = ref(0)
  /** Текущий скролл */
  const scrollTop = ref(0)

  /** Актуальное значение высоты элемента (разворачиваем ref/computed) */
  const resolvedItemHeight = computed(() => {
    const h = unref(itemHeight)
    // Защита от нуля: пока ResizeObserver не сработал,
    // используем безопасный дефолт, чтобы не схлопнуть список
    return h > 0 ? h : 62
  })

  /** Общая высота всех элементов */
  const totalHeight = computed(() => items.value.length * resolvedItemHeight.value)

  /** Индекс первого видимого элемента */
  const startIndex = computed(() => {
    const raw = Math.floor(scrollTop.value / resolvedItemHeight.value) - overscan
    return Math.max(0, raw)
  })

  /** Индекс последнего видимого элемента (не включительно) */
  const endIndex = computed(() => {
    const visibleCount = Math.ceil(viewportHeight.value / resolvedItemHeight.value)
    const raw = startIndex.value + visibleCount + overscan * 2
    return Math.min(items.value.length, raw)
  })

  /** Видимый срез */
  const visibleItems = computed(() =>
    items.value.slice(startIndex.value, endIndex.value).map((item, i) => ({
      item,
      index: startIndex.value + i,
    })),
  )

  /** Смещение для transform — чтобы видимые элементы оказались на нужной позиции */
  const offsetY = computed(() => startIndex.value * resolvedItemHeight.value)

  // --- Обработка скролла -----------------------------------------------

  let rafId: number | null = null

  function onScroll(): void {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      if (containerRef.value) {
        scrollTop.value = containerRef.value.scrollTop
      }
    })
  }

  // --- Обработка resize ------------------------------------------------

  let resizeObserver: ResizeObserver | null = null
  // Сохраняем ссылку на элемент в замыкании — к моменту onUnmounted
  // containerRef.value может быть уже null, и removeEventListener не сработает
  let observedEl: HTMLElement | null = null

  function updateViewportHeight(): void {
    if (containerRef.value) {
      viewportHeight.value = containerRef.value.clientHeight
    }
  }

  onMounted(() => {
    updateViewportHeight()
    observedEl = containerRef.value

    if (observedEl) {
      observedEl.addEventListener('scroll', onScroll, { passive: true })

      // ResizeObserver — чтобы реагировать на изменение размера окна
      // и на изменение layout (например, открытие devtools)
      resizeObserver = new ResizeObserver(updateViewportHeight)
      resizeObserver.observe(observedEl)
    }
  })

  onUnmounted(() => {
    if (observedEl) {
      observedEl.removeEventListener('scroll', onScroll)
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }
  })

  // --- Реакция на изменение items --------------------------------------

  watch(
    () => items.value.length,
    () => {
      // После смены массива скролл может «улететь» за пределы.
      // Просто синхронизируем scrollTop с реальным положением.
      if (containerRef.value) {
        scrollTop.value = containerRef.value.scrollTop
      }
    },
  )

  /** Прокрутить к элементу по индексу */
  function scrollToIndex(index: number): void {
    if (!containerRef.value) return
    const target = index * resolvedItemHeight.value
    const viewport = viewportHeight.value
    const current = containerRef.value.scrollTop

    // Если элемент выше видимой области — скроллим так, чтобы он был сверху
    if (target < current || target > current + viewport - resolvedItemHeight.value) {
      containerRef.value.scrollTop = target
    }
  }

  return {
    totalHeight,
    visibleItems,
    offsetY,
    startIndex,
    endIndex,
    scrollToIndex,
  }
}
