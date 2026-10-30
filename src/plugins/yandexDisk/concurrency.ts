// src/plugins/yandexDisk/concurrency.ts

export interface MapWithConcurrencyOptions {
  shouldStop?: () => boolean;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  options: MapWithConcurrencyOptions = {},
): Promise<R[]> {
  const { shouldStop } = options;
  const results: R[] = Array.from({ length: items.length });
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      if (shouldStop?.()) return;
      const index = cursor++;
      results[index] = await fn(items[index]!, index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));

  return results;
}
