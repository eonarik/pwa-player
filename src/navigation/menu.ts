// src/navigation/menu.ts

import type { IconName } from '@/components/icons';

export interface MenuItem {
  /** route.name для router.push / RouterLink */
  route?: string;
  /** Отображаемое имя */
  label: string;
  /** Имя иконки из реестра */
  icon: IconName;
  /** Показывать бейдж с числом треков в очереди */
  queueBadge?: boolean;
  /** Если задано — пункт открывает модалку, а не роут */
  modal?: 'feedback';
}

export const MENU_ITEMS: MenuItem[] = [
  { route: 'home', label: 'Главная', icon: 'home' },
  { route: 'search', label: 'Поиск', icon: 'search' },
  { route: 'artists', label: 'Исполнители', icon: 'artist' },
  { route: 'albums', label: 'Альбомы', icon: 'album' },
  { route: 'playlists', label: 'Плейлисты', icon: 'playlist' },
  { route: 'history', label: 'История', icon: 'history' },
  { route: 'queue', label: 'Очередь', icon: 'list', queueBadge: true },
  { route: 'dislikes', label: 'Дизлайки', icon: 'eye-off' },
  { route: 'settings', label: 'Настройки', icon: 'settings' },
  { label: 'Обратная связь', icon: 'feedback', modal: 'feedback' },
];
