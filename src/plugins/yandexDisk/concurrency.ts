// src/plugins/yandexDisk/concurrency.ts

export interface MapWithConcurrencyOptions {
  /**
   * Проверка на досрочную остановку. Вызывается перед обработкой
   * каждого элемента. Если вернёт `true` — воркер завершается,
   * оставшиеся результаты остаются `undefined`.
   *
   * Используется для отмены длинных операций (например, обхода
   * поддерева Яндекс.Диска при отключении плагина).
   */
  shouldStop?: () => boolean
}

/**
 * Прогоняет fn по всем items, но не более concurrency одновременно.
 * Сохраняет порядок результатов.
 *
 * Если `options.shouldStop()` возвращает `true`, обработка прекращается,
 * а незаполненные результаты остаются `undefined`. Вызывающий код
 * должен проверить это (например, через `if (!result) continue`).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  options: MapWithConcurrencyOptions = {},
): Promise<R[]> {
  const { shouldStop } = options
  const results: R[] = Array.from({ length: items.length })
  let cursor = 0

  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      if (shouldStop?.()) return
      const index = cursor++
      results[index] = await fn(items[index]!, index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))

  return results
}
