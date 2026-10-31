// src/stores/library/store/state.ts

import { ref, toRaw, type Ref } from 'vue';
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
    tracks: ref({} as Record<TrackId, Track>),
    albums: ref({} as Record<AlbumId, Album>),
    folders: ref({} as Record<FolderId, FolderRef>),
    currentFolderId: ref(null),
  };
}

/**
 * Глубокое снятие Proxy (нужно для structuredClone).
 * FileSystemFileHandle и Blob оставляем как есть — их нельзя сериализовать.
 */
export function deepToRaw<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(deepToRaw) as unknown as T;
  if (typeof window !== 'undefined' && (obj instanceof FileSystemFileHandle || obj instanceof Blob)) {
    return obj;
  }

  const raw = toRaw(obj);
  const result: Record<string, unknown> = {};
  for (const key in raw) {
    result[key] = deepToRaw((raw as Record<string, unknown>)[key]);
  }
  return result as T;
}
