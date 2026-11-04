// src/utils/urlPath.ts

/**
 * Преобразует urlPath в массив сегментов для router.push.
 * Отсекает пустые сегменты — корень '' → [], 'Music' → ['Music'],
 * 'Music/Album' → ['Music', 'Album'].
 *
 * Для legacy `'/'` → [] (корень).
 */
export function urlPathToSegments(urlPath: string | null | undefined): string[] {
  if (!urlPath) return [];
  return urlPath.split('/').filter(Boolean);
}
