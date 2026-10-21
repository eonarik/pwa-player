// src/plugins/yandexDisk/concurrency.spec.ts

import { describe, it, expect } from 'vitest'
import { mapWithConcurrency } from './concurrency'

describe('mapWithConcurrency', () => {
  it('сохраняет порядок результатов', async () => {
    const items = [1, 2, 3, 4, 5]
    const results = await mapWithConcurrency(items, 2, async (x) => x * 10)
    expect(results).toEqual([10, 20, 30, 40, 50])
  })

  it('не превышает concurrency', async () => {
    const items = [1, 2, 3, 4, 5, 6]
    let running = 0
    let maxRunning = 0

    await mapWithConcurrency(items, 3, async () => {
      running++
      maxRunning = Math.max(maxRunning, running)
      await new Promise((r) => setTimeout(r, 10))
      running--
    })

    expect(maxRunning).toBeLessThanOrEqual(3)
  })

  it('пустой массив → пустой результат', async () => {
    const results = await mapWithConcurrency([], 5, async () => 'x')
    expect(results).toEqual([])
  })

  it('shouldStop останавливает обработку (concurrency: 1)', async () => {
    const items = [1, 2, 3, 4, 5]
    const processed: number[] = []
    let stop = false

    const results = await mapWithConcurrency(
      items,
      1,
      async (x) => {
        processed.push(x)
        if (x === 2) stop = true
        return x
      },
      { shouldStop: () => stop },
    )

    // После обработки 2 shouldStop вернёт true, третий элемент не начнётся
    expect(processed).toEqual([1, 2])
    expect(results[0]).toBe(1)
    expect(results[1]).toBe(2)
    expect(results[2]).toBeUndefined()
    expect(results[3]).toBeUndefined()
    expect(results[4]).toBeUndefined()
  })

  it('shouldStop не мешает, если всегда false', async () => {
    const items = [1, 2, 3]
    const results = await mapWithConcurrency(items, 2, async (x) => x, {
      shouldStop: () => false,
    })
    expect(results).toEqual([1, 2, 3])
  })

  it('shouldStop с конкурентностью > 1: часть элементов не обрабатывается', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    let stop = false
    const processed: number[] = []

    const results = await mapWithConcurrency(
      items,
      2,
      async (x) => {
        processed.push(x)
        // Первый обработанный элемент выставляет stop.
        // Второй воркер мог успеть взять элемент параллельно — это ок.
        if (processed.length === 1) {
          stop = true
        }
        return x
      },
      { shouldStop: () => stop },
    )

    // Детерминированно проверяем только то, что не все элементы обработаны.
    // Точное количество зависит от таймингов: первый воркер выставляет stop,
    // второй мог успеть взять 1 элемент до проверки shouldStop.
    expect(processed.length).toBeGreaterThanOrEqual(1)
    expect(processed.length).toBeLessThan(items.length)

    // Результаты сохраняют длину исходного массива
    expect(results.length).toBe(items.length)

    // Хотя бы один из последних элементов не обработан
    const processedSet = new Set(processed)
    const untouched = items.filter((x) => !processedSet.has(x))
    expect(untouched.length).toBeGreaterThan(0)
  })
})
