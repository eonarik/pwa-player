// server/src/disk/filter.ts

/**
 * Фильтрует список элементов, оставляя только те, которые доступны без авторизации.
 *
 * Правила:
 * - Если publicFolders содержит '/' → всё доступно.
 * - Иначе: оставляем элементы, чей путь совпадает с публичной папкой
 *   или начинается с неё (для родительских папок).
 * - Также оставляем элементы, которые являются родителями публичной папки
 *   (чтобы можно было до неё дойти).
 *
 * @param items — элементы из ответа Яндекса (пути уже относительные: /nostalgy)
 * @param currentPath — путь, который запросили (например, '/')
 * @param publicFolders — из .settings.json
 */
export function filterPublicItems(items, currentPath, publicFolders) {
  // Всё публично
  if (publicFolders.some((p) => p === '/' || p === '')) {
    return items
  }

  const normalizedPublic = publicFolders.map(normalizePath)

  return items.filter((item) => {
    const itemPath = normalizePath(item.path)
    return normalizedPublic.some((pub) => {
      // Прямое совпадение (папка сама публична)
      if (itemPath === pub) return true

      // Элемент — родитель публичной папки (нужен для навигации)
      // Например, публична /nostalgy/2020, а мы на /nostalgy → должен видеть 2020
      if (pub.startsWith(itemPath + '/')) return true

      // Элемент — внутри публичной папки
      // Например, публична /nostalgy, а мы на /nostalgy → видим всё содержимое
      if (itemPath.startsWith(pub + '/')) return true

      return false
    })
  })
}

function normalizePath(path) {
  return path.replace(/^disk:/, '').replace(/\/+$/, '') || '/'
}
