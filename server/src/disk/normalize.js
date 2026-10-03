// server/src/disk/normalize.js

/**
 * Нормализует клиентский путь:
 * - убирает префикс `disk:`
 * - убирает ведущие и хвостовые слэши
 * - схлопывает `.` и `..`
 * - не даёт выйти выше корня
 */
export function normalizeClientPath(clientPath) {
  const stripped = clientPath
    .replace(/^disk:/, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  if (stripped === '') return ''

  const parts = stripped.split('/')
  const stack = []

  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (stack.length > 0) stack.pop()
      continue
    }
    stack.push(part)
  }

  return stack.join('/')
}
