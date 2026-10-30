// src/utils/sort.ts

import type { Track } from '@/types/track';

const collator = new Intl.Collator('ru', {
  numeric: true,
  sensitivity: 'base',
});

export function compareStrings(a: string, b: string): number {
  return collator.compare(a, b);
}

export function sortBy<T>(items: T[], getKey: (item: T) => string): T[] {
  return [...items].sort((a, b) => collator.compare(getKey(a), getKey(b)));
}

export function trackSortKey(track: Track): string {
  const num = track.trackNumber;
  if (num != null) {
    return num.toString().padStart(3, '0') + ' ' + track.title;
  }
  return track.title;
}
