// src/stores/library/store/state.ts

import { ref, type Ref } from 'vue';
import type { Track } from '@/types/track';
import type { Album } from '@/types/album';
import type { FolderRef } from '@/types/folder';
import type { AlbumId, FolderId, TrackId } from '@/types/ids';

export interface LibraryRefs {
  tracks: Ref<Record<TrackId, Track>>;
  albums: Ref<Record<AlbumId, Album>>;
  folders: Ref<Record<FolderId, FolderRef>>;
  currentFolderId: Ref<FolderId | null>;
}

export function createLibraryRefs(): LibraryRefs {
  return {
    // deep ref: computed свойства полагаются на реактивность при
    // s.tracks[id] = track / delete s.tracks[id].
    // Host-объекты (FileSystemFileHandle) пропускаются Vue — не вызывают ошибок.
    // Переход на shallowRef потребовал бы замены ~40 мутаций на spread-присваивание;
    // нецелесообразно — нет подтверждённых проблем с производительностью.
    tracks: ref({} as Record<TrackId, Track>),
    albums: ref({} as Record<AlbumId, Album>),
    folders: ref({} as Record<FolderId, FolderRef>),
    currentFolderId: ref(null),
  };
}
