// src/navigation/menu.ts

import type { Component } from 'vue'
import IconHome from '@/components/icons/IconHome.vue'
import IconSearch from '@/components/icons/IconSearch.vue'
import IconPlaylist from '@/components/icons/IconPlaylist.vue'
import IconHistory from '@/components/icons/IconHistory.vue'
import IconList from '@/components/icons/IconList.vue'
import IconEyeOff from '@/components/icons/IconEyeOff.vue'
import IconSettings from '@/components/icons/IconSettings.vue'

export interface MenuItem {
  /** route.name для router.push / RouterLink */
  route: string
  /** Отображаемое имя */
  label: string
  /** Иконка */
  icon: Component
  /** Показывать бейдж с числом треков в очереди */
  queueBadge?: boolean
}

export const MENU_ITEMS: MenuItem[] = [
  { route: 'home', label: 'Главная', icon: IconHome },
  { route: 'search', label: 'Поиск', icon: IconSearch },
  { route: 'playlists', label: 'Плейлисты', icon: IconPlaylist },
  { route: 'history', label: 'История', icon: IconHistory },
  { route: 'queue', label: 'Очередь', icon: IconList, queueBadge: true },
  { route: 'dislikes', label: 'Дизлайки', icon: IconEyeOff },
  { route: 'settings', label: 'Настройки', icon: IconSettings },
]
