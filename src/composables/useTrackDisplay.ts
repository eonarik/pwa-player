// src/composables/useTrackDisplay.ts

import { computed, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { getTrackPath } from '@/utils/trackPath'
import type { Track } from '@/types/track'

export function useTrackDisplay(track: Ref<Track | null | undefined>) {
  const uiSettings = useUiSettingsStore()
  const { showSource } = storeToRefs(uiSettings)

  const hasArtist = computed(() => Boolean(track.value?.artist?.trim()))

  /** Только название трека (без артиста). Артист рендерится отдельно — как ссылка. */
  const title = computed(() => track.value?.title ?? '')

  /** Подзаголовок: путь в showSource, иначе пусто (артист рендерится отдельно). */
  const subtitle = computed(() => {
    const t = track.value
    if (!t) return ''
    if (showSource.value) return getTrackPath(t)
    return ''
  })

  const hasSubtitle = computed(() => subtitle.value.length > 0)

  return { showSource, hasArtist, title, subtitle, hasSubtitle }
}
