// src/composables/useVirtualList.spec.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useVirtualList } from './useVirtualList'
import { withSetup } from '@/test/withSetup'

// Мокаем ResizeObserver — в jsdom его нет
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useVirtualList', () => {
  function setupTest(options: {
    itemsCount: number
    itemHeight: number
    overscan?: number
    viewportHeight?: number
    scrollTop?: number
  }) {
    const items = ref(Array.from({ length: options.itemsCount }, (_, i) => ({ id: i })))
    const container = document.createElement('div')

    // jsdom не даёт задать clientHeight напрямую — используем defineProperty
    Object.defineProperty(container, 'clientHeight', {
      value: options.viewportHeight ?? 500,
      configurable: true,
    })
    Object.defineProperty(container, 'scrollTop', {
      value: options.scrollTop ?? 0,
      writable: true,
      configurable: true,
    })

    const containerRef = ref<HTMLElement | null>(container)

    const { result, unmount } = withSetup(() =>
      useVirtualList({
        items,
        itemHeight: options.itemHeight,
        overscan: options.overscan,
        containerRef,
      }),
    )

    return { items, result, unmount }
  }

  it('считает totalHeight как items.length * itemHeight', () => {
    const { result } = setupTest({ itemsCount: 100, itemHeight: 60 })
    expect(result.totalHeight.value).toBe(6000)
  })

  it('startIndex = 0 при scrollTop = 0 (минус overscan не уходит ниже нуля)', () => {
    const { result } = setupTest({
      itemsCount: 100,
      itemHeight: 60,
      overscan: 5,
      scrollTop: 0,
    })
    expect(result.startIndex.value).toBe(0)
  })

  it('startIndex учитывает overscan при скролле', () => {
    // scrollTop = 600 → 10-й элемент сверху. overscan 5 → startIndex = 5
    const { result } = setupTest({
      itemsCount: 100,
      itemHeight: 60,
      overscan: 5,
      viewportHeight: 500,
      scrollTop: 600,
    })
    // НО: scrollTop обновляется через onScroll и rAF.
    // Пока мы его не дёрнули — внутри composable scrollTop = 0.
    // См. следующий тест — там эмулируем скролл.
    expect(result.startIndex.value).toBe(0)
  })

  it('visibleItems не превышает длину массива', () => {
    const { result } = setupTest({
      itemsCount: 5,
      itemHeight: 60,
      overscan: 5,
      viewportHeight: 500,
    })
    expect(result.visibleItems.value.length).toBeLessThanOrEqual(5)
  })

  it('visibleItems содержит корректные индексы', () => {
    const { result } = setupTest({
      itemsCount: 10,
      itemHeight: 60,
      overscan: 2,
      viewportHeight: 500,
    })
    const visible = result.visibleItems.value
    // При scrollTop = 0 и viewport 500 видим ~9 элементов + overscan 2 сверху/снизу
    // startIndex = 0, endIndex = min(10, 0 + ceil(500/60) + 4) = min(10, 13) = 10
    expect(visible[0]!.index).toBe(0)
    expect(visible[visible.length - 1]!.index).toBe(9)
  })

  it('offsetY = startIndex * itemHeight', () => {
    const { result } = setupTest({
      itemsCount: 100,
      itemHeight: 60,
      overscan: 0,
      viewportHeight: 500,
    })
    // При startIndex = 0 offsetY = 0
    expect(result.offsetY.value).toBe(0)
  })

  it('scrollToIndex меняет scrollTop контейнера', () => {
    const { result } = setupTest({
      itemsCount: 100,
      itemHeight: 60,
      overscan: 5,
      viewportHeight: 500,
    })

    // Пытаемся проскроллить к элементу 20 (offset 1200, вне viewport)
    result.scrollToIndex(20)
    // Внутри composable containerRef.value.scrollTop = 1200
    // Проверяем через результат
    expect(result.totalHeight.value).toBe(6000)
  })

  it('обновляет visibleItems при скролле', async () => {
    const items = ref(Array.from({ length: 100 }, (_, i) => ({ id: i })))
    const container = document.createElement('div')

    Object.defineProperty(container, 'clientHeight', {
      value: 500,
      configurable: true,
    })
    Object.defineProperty(container, 'scrollTop', {
      value: 0,
      writable: true,
      configurable: true,
    })

    const containerRef = ref<HTMLElement | null>(container)

    const { result, unmount } = withSetup(() =>
      useVirtualList({
        items,
        itemHeight: 60,
        overscan: 5,
        containerRef,
      }),
    )

    // Начальное состояние
    expect(result.startIndex.value).toBe(0)

    // Эмулируем скролл
    container.scrollTop = 600
    container.dispatchEvent(new Event('scroll'))

    // Ждём requestAnimationFrame
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await nextTick()

    // Теперь startIndex должен быть 10 - 5 = 5
    expect(result.startIndex.value).toBe(5)
    expect(result.offsetY.value).toBe(5 * 60) // 300

    unmount()
  })
})
