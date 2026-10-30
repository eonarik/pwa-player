// src/composables/useDocumentTitle.ts

import { watchEffect, type Ref } from 'vue';
import type { Track } from '@/types/track';

export function useDocumentTitle(currentTrack: Ref<Track | null>) {
  watchEffect(() => {
    const t = currentTrack.value;
    document.title = t ? `${t.title} — ${t.artist}` : 'CUEI Media Player';
  });
}
