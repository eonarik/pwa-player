// src/navigation/title.ts

import type { RouteLocationNormalizedLoaded } from 'vue-router';
import { NO_ALBUM_LABEL, NO_ALBUM_SLUG } from '@/utils/artists';
import { MENU_ITEMS } from './menu';

export interface PageTitleContext {
  folderName: string | null;
  playlistName: string | null;
  albumName: string | null;
}

export function getPageTitle(route: RouteLocationNormalizedLoaded, ctx: PageTitleContext): string {
  const menuItem = MENU_ITEMS.find((item) => item.route === route.name);
  if (menuItem) return menuItem.label;

  switch (route.name) {
    case 'folder':
      return ctx.folderName ?? 'Папка';
    case 'playlist':
      return ctx.playlistName ?? 'Плейлист';
    case 'artist':
      return String(route.params.artistName ?? 'Артист');
    case 'album': {
      const artistName = String(route.params.artistName ?? '');
      const albumParam = String(route.params.album ?? '');
      if (albumParam === NO_ALBUM_SLUG) return `${artistName} — ${NO_ALBUM_LABEL}`;
      const albumName = ctx.albumName ?? 'Альбом';
      return artistName ? `${artistName} — ${albumName}` : albumName;
    }
    default:
      return 'Плеер';
  }
}
