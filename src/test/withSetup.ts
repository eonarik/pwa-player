// src/test/withSetup.ts

import { createApp, type App } from 'vue'

/**
 * Вызывает composable в контексте setup-функции компонента.
 * Возвращает результат + app-инстанс для cleanup.
 *
 * Использование:
 *   const { result, unmount } = withSetup(() => useVirtualList({ ... }))
 *   ...
 *   unmount()
 */
export function withSetup<T>(composable: () => T): {
  result: T
  app: App
  unmount: () => void
} {
  let result!: T

  const app = createApp({
    setup() {
      result = composable()
      return () => null // рендерим пустоту
    },
  })

  app.mount(document.createElement('div'))

  return {
    result,
    app,
    unmount: () => app.unmount(),
  }
}
