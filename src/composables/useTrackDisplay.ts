// src/composables/useTrackDisplay.ts

import { computed, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { getTrackPath } from '@/utils/trackPath'
import type { Track } from '@/types/track'

export function useTrackDisplay(track: Ref<Track | null | undefined>) {
  const uiSettings = useUiSettingsStore()
  const { showSource } = storeToRefs(uiSettings)

  const title = computed(() => {
    const t = track.value
    if (!t) return ''
    if (!showSource.value) return t.title
    const artist = t.artist?.trim()
    return artist ? `${artist} — ${t.title}` : t.title
  })

  const subtitle = computed(() => {
    const t = track.value
    if (!t) return ''
    if (showSource.value) return getTrackPath(t)
    return t.artist?.trim() ?? ''
  })

  const hasSubtitle = computed(() => subtitle.value.length > 0)

  return { title, subtitle, hasSubtitle }
}
