// src/components/icons/index.ts
import type { Component } from 'vue'

import IconX from './IconX.vue'
import IconPlay from './IconPlay.vue'
import IconPause from './IconPause.vue'
import IconNext from './IconNext.vue'
import IconPrev from './IconPrev.vue'
import IconShuffle from './IconShuffle.vue'
import IconRepeat from './IconRepeat.vue'
import IconVolume from './IconVolume.vue'
import IconVolumeMute from './IconVolumeMute.vue'
import IconList from './IconList.vue'
import IconSettings from './IconSettings.vue'
import IconRefresh from './IconRefresh.vue'
import IconDownload from './IconDownload.vue'
import IconCloudCheck from './IconCloudCheck.vue'
import IconDots from './IconDots.vue'
import IconArrowLeft from './IconArrowLeft.vue'
import IconArrowUp from './IconArrowUp.vue'
import IconArrowDown from './IconArrowDown.vue'
import IconChevronLeft from './IconChevronLeft.vue'
import IconChevronRight from './IconChevronRight.vue'
import IconChevronDown from './IconChevronDown.vue'
import IconSearch from './IconSearch.vue'
import IconHeart from './IconHeart.vue'
import IconEyeOff from './IconEyeOff.vue'
import IconSpinner from './IconSpinner.vue'
import IconTrash from './IconTrash.vue'
import IconPlus from './IconPlus.vue'
import IconCheck from './IconCheck.vue'
import IconPencil from './IconPencil.vue'
import IconShare from './IconShare.vue'
import IconMaximize from './IconMaximize.vue'
import IconMinimize from './IconMinimize.vue'
import IconFile from './IconFile.vue'
import IconFolder from './IconFolder.vue'
import IconPlaylist from './IconPlaylist.vue'
import IconHistory from './IconHistory.vue'
import IconHome from './IconHome.vue'
import IconArtist from './IconArtist.vue'
import IconAlbum from './IconAlbum.vue'
import IconRadio from './IconRadio.vue'
import IconLink from './IconLink.vue'
import IconMenu from './IconMenu.vue'
import IconFeedback from './IconFeedback.vue'
import IconAlertTriangle from './IconAlertTriangle.vue'

/**
 * Реестр всех иконок проекта.
 * Ключ — имя, которое используется в `icon="..."`, значение — компонент.
 */
export const ICONS: Record<string, Component> = {
  x: IconX,
  play: IconPlay,
  pause: IconPause,
  next: IconNext,
  prev: IconPrev,
  shuffle: IconShuffle,
  repeat: IconRepeat,
  volume: IconVolume,
  'volume-mute': IconVolumeMute,
  list: IconList,
  settings: IconSettings,
  refresh: IconRefresh,
  download: IconDownload,
  'cloud-check': IconCloudCheck,
  dots: IconDots,
  'arrow-left': IconArrowLeft,
  'arrow-up': IconArrowUp,
  'arrow-down': IconArrowDown,
  'chevron-left': IconChevronLeft,
  'chevron-right': IconChevronRight,
  'chevron-down': IconChevronDown,
  search: IconSearch,
  heart: IconHeart,
  'eye-off': IconEyeOff,
  spinner: IconSpinner,
  trash: IconTrash,
  plus: IconPlus,
  check: IconCheck,
  pencil: IconPencil,
  share: IconShare,
  maximize: IconMaximize,
  minimize: IconMinimize,
  file: IconFile,
  folder: IconFolder,
  playlist: IconPlaylist,
  history: IconHistory,
  home: IconHome,
  artist: IconArtist,
  album: IconAlbum,
  radio: IconRadio,
  link: IconLink,
  menu: IconMenu,
  feedback: IconFeedback,
  'alert-triangle': IconAlertTriangle,
}

export type IconName = keyof typeof ICONS
