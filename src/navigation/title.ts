// src/navigation/title.ts

import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { NO_ALBUM_LABEL, NO_ALBUM_SLUG } from '@/utils/artists'
import { MENU_ITEMS } from './menu'

/**
 * Возвращает заголовок страницы для FullPlayer.
 *
 * Логика:
 * 1. Если route.name есть в MENU_ITEMS — берём label.
 * 2. Иначе — динамические роуты:
 *    - 'folder' → имя текущей папки.
 *    - 'playlist' → имя плейлиста.
 *    - 'artist' → artistName.
 *    - 'album' → '{artistName} — {album}'.
 * 3. Fallback — 'Плеер'.
 *
 * Зависимости (library, playlists) передаются снаружи, чтобы хелпер
 * оставался чистым и не тащил Pinia-сторы.
 */
export interface PageTitleContext {
  folderName: string | null
  playlistName: string | null
}

export function getPageTitle(route: RouteLocationNormalizedLoaded, ctx: PageTitleContext): string {
  const menuItem = MENU_ITEMS.find((item) => item.route === route.name)
  if (menuItem) return menuItem.label

  switch (route.name) {
    case 'folder':
      return ctx.folderName ?? 'Папка'
    case 'playlist':
      return ctx.playlistName ?? 'Плейлист'
    case 'artist':
      return String(route.params.artistName ?? 'Артист')
    case 'album': {
      const artistName = String(route.params.artistName ?? '')
      const album = String(route.params.album ?? '')
      if (album === NO_ALBUM_SLUG) return `${artistName} — ${NO_ALBUM_LABEL}`
      return `${artistName} — ${album}`
    }
    default:
      return 'Плеер'
  }
}
