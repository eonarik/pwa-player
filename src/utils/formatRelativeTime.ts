// src/utils/formatRelativeTime.ts

/**
 * Относительное время: «только что», «5 мин назад», «2 ч назад», «3 дн назад»,
 * затем — дата в формате `дд мес`.
 */
export function formatRelativeTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин назад`
  if (hours < 24) return `${hours} ч назад`
  if (days < 7) return `${days} дн назад`

  return new Date(ts).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })
}
