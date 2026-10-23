// src/services/audio/toPlayableUrl.ts

/**
 * Подставляет HLS-прокси, если ссылка ведёт на .m3u8.
 * Для прямых mp3/aac оставляет как есть.
 */
export function toPlayableUrl(url: string): string {
  if (!url) return url

  try {
    const parsed = new URL(url, window.location.origin)
    // Если это .m3u8 (или m3u, который ведёт на HLS) — проксируем
    if (parsed.pathname.endsWith('.m3u8')) {
      return `/api/hls-proxy?url=${encodeURIComponent(parsed.toString())}`
    }
    return url
  } catch {
    return url
  }
}
