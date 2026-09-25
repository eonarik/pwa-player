// src/utils/sort.ts

import type { LibraryTrack } from '@/types/library'

/**
 * Коллатор для сортировки названий треков и папок.
 * Учитывает кириллицу, цифры, регистр.
 *
 * numeric: true — "track2" < "track10", а не наоборот.
 * sensitivity: 'base' — игнорирует регистр и диакритику.
 */
const collator = new Intl.Collator('ru', {
  numeric: true,
  sensitivity: 'base',
})

/** Сравнить две строки для сортировки */
export function compareStrings(a: string, b: string): number {
  return collator.compare(a, b)
}

/** Отсортировать массив объектов по строковому ключу */
export function sortBy<T>(items: T[], getKey: (item: T) => string): T[] {
  return [...items].sort((a, b) => collator.compare(getKey(a), getKey(b)))
}

/**
 * Ключ сортировки для трека.
 * Если есть trackNumber — сортируем по нему, с ведущими нулями.
 * Иначе — по title.
 */
export function trackSortKey(track: LibraryTrack): string {
  const num = track.trackNumber
  if (num != null) {
    return num.toString().padStart(3, '0') + ' ' + track.title
  }
  return track.title
}
