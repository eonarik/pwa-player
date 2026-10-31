// src/navigation/menu.ts

import type { IconName } from '@/components/icons';

export interface MenuItem {
  route?: string;
  label: string;
  icon: IconName;
  queueBadge?: boolean;
  modal?: 'feedback';
  params?: Record<string, string>;
}

export const MENU_ITEMS: MenuItem[] = [
  { route: 'home', label: 'Главная', icon: 'home' },
  { route: 'artists', label: 'Исполнители', icon: 'artist' },
  { route: 'albums', label: 'Альбомы', icon: 'album' },
  { route: 'history', label: 'История', icon: 'history' },
  { route: 'queue', label: 'Очередь', icon: 'list-play', queueBadge: true },
  { route: 'dislikes', label: 'Дизлайки', icon: 'eye-off' },
  { label: 'Обратная связь', icon: 'feedback', modal: 'feedback' },
];

export const TOP_BAR_ITEMS: MenuItem[] = [
  { route: 'search', label: 'Поиск', icon: 'search' },
  { route: 'playlists', label: 'Плейлисты', icon: 'playlist' },
  { route: 'playlist', label: 'Избранное', icon: 'heart', params: { id: 'playlist:favorites' } },
  { route: 'settings', label: 'Настройки', icon: 'settings' },
];
