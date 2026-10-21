// server/src/plugins/yandex-self/filter.js

import { isAudioFile } from '../../shared/audio.js'

export { isAudioFile }

export function mapAndFilterItems(items, path, allowedFolders) {
  // 1. Добавляем isAudio
  let result = (items || []).map((item) => ({
    ...item,
    isAudio: item.type === 'file' && isAudioFile(item.name),
  }))

  // 2. Фильтруем по allowedFolders
  if (Array.isArray(allowedFolders) && allowedFolders.length > 0) {
    result = result.filter((item) => {
      const itemPath = path === '/' ? '/' + item.name : path + '/' + item.name
      return allowedFolders.some((f) => {
        const cleanF = f.replace(/\/+$/, '')
        return (
          cleanF === itemPath ||
          cleanF.startsWith(itemPath + '/') ||
          itemPath.startsWith(cleanF + '/')
        )
      })
    })
  }

  return result
}

export function normalizePath(path, root) {
  let p = path.replace(/^disk:/, '')
  if (!p.startsWith('/')) p = '/' + p
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)

  let cleanRoot = root.replace(/\/+$/, '')
  if (cleanRoot && !cleanRoot.startsWith('/')) cleanRoot = '/' + cleanRoot

  if (cleanRoot && p.startsWith(cleanRoot)) {
    p = p.slice(cleanRoot.length)
    if (!p.startsWith('/')) p = '/' + p
  }
  if (p === '') p = '/'

  return { path: p, cleanRoot }
}
