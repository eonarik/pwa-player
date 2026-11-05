// src/plugins/yandexSelf/logii/useLogiiData.ts

import { computed, ref, type Ref } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { parseLogii, stringifyLogii, type LogiiData } from './parseLogii';
import { readLogiiFile, writeLogiiFile } from './logiiApi';
import type { FolderRef, FolderFile } from '@/types/folder';
import type { Track } from '@/types/track';

const NICKNAME_KEY = 'logii:nickname';

export function getNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setNickname(nickname: string): void {
  try {
    localStorage.setItem(NICKNAME_KEY, nickname.trim());
  } catch {
    // ignore
  }
}

// --- Типы ---
export interface LogiiSeasonItem {
  folderName: string;
  displayName: string;
  urlPath: string;
}

export interface LogiiAuthorItem {
  folderName: string;
  urlPath: string;
}

export interface LogiiTrackItem {
  folderName: string;
  urlPath: string;
  folderId: string;
  isIntro: boolean;
  audioTracks: Track[];
  imageFiles: FolderFile[];
  logiiFileName: string | null;
}

// --- Хелперы над library ---
function findFolderByUrlPath(folders: Record<string, FolderRef>, urlPath: string): FolderRef | null {
  const normalized = urlPath.replace(/^\/+/, '').replace(/\/+$/, '');
  for (const f of Object.values(folders)) {
    if (f.urlPath === normalized) return f;
  }
  return null;
}

function folderChildren(folders: Record<string, FolderRef>, parentId: string): FolderRef[] {
  const result: FolderRef[] = [];
  for (const f of Object.values(folders)) {
    if (f.parentId === parentId) result.push(f);
  }
  return result;
}

function urlPathOf(folder: FolderRef): string {
  return folder.urlPath;
}

function buildTrackItem(folder: FolderRef, tracks: Record<string, Track>, isIntro = false): LogiiTrackItem {
  const audioTracks: Track[] = [];
  for (const trackId of folder.trackIds) {
    const track = tracks[trackId];
    if (track) audioTracks.push(track);
  }

  const imageFiles: FolderFile[] = [];
  let logiiFileName: string | null = null;

  for (const file of folder.files ?? []) {
    if (file.ext === '.txt') {
      if (logiiFileName === null) logiiFileName = file.name;
      continue;
    }
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(file.ext)) {
      imageFiles.push(file);
    }
  }

  return {
    folderName: folder.name,
    urlPath: urlPathOf(folder),
    folderId: folder.id,
    isIntro,
    audioTracks,
    imageFiles,
    logiiFileName,
  };
}

// --- useLogiiSeason ---

export interface UseLogiiSeasonResult {
  authors: Ref<LogiiAuthorItem[]>;
  tracksByAuthor: Ref<Map<string, LogiiTrackItem[]>>;
  authorMeta: Ref<Map<string, LogiiTrackItem>>;
  seasonFolder: Ref<FolderRef | null>;
  isReady: Ref<boolean>;
}

export function useLogiiSeason(seasonUrlPath: Ref<string>): UseLogiiSeasonResult {
  const library = useLibraryStore();

  const seasonFolder = computed<FolderRef | null>(() => findFolderByUrlPath(library.folders, seasonUrlPath.value));
  const isReady = computed(() => seasonFolder.value !== null);

  const authors = computed<LogiiAuthorItem[]>(() => {
    if (!seasonFolder.value) return [];
    return folderChildren(library.folders, seasonFolder.value.id).map((f) => ({
      folderName: f.name,
      urlPath: urlPathOf(f),
    }));
  });

  const authorMeta = computed<Map<string, LogiiTrackItem>>(() => {
    const map = new Map<string, LogiiTrackItem>();
    if (!seasonFolder.value) return map;
    const authorFolders = folderChildren(library.folders, seasonFolder.value.id);
    for (const author of authorFolders) {
      map.set(urlPathOf(author), buildTrackItem(author, library.tracks, true));
    }
    return map;
  });

  const tracksByAuthor = computed<Map<string, LogiiTrackItem[]>>(() => {
    const map = new Map<string, LogiiTrackItem[]>();
    if (!seasonFolder.value) return map;
    const authorFolders = folderChildren(library.folders, seasonFolder.value.id);
    for (const author of authorFolders) {
      const tracks = folderChildren(library.folders, author.id);
      map.set(
        urlPathOf(author),
        tracks.map((t) => buildTrackItem(t, library.tracks, false)),
      );
    }
    return map;
  });

  return { authors, tracksByAuthor, authorMeta, seasonFolder, isReady };
}

// --- useLogiiTrack ---

export interface UseLogiiTrackResult {
  data: Ref<LogiiData | null>;
  isLoading: Ref<boolean>;
  isSaving: Ref<boolean>;
  error: Ref<string>;
  reload: (forceRefresh?: boolean) => Promise<void>;
  appendComment: (text: string) => Promise<boolean>;
  updateVibe: (text: string) => Promise<boolean>;
}

export function useLogiiTrack(trackUrlPath: Ref<string>, logiiFileName: Ref<string | null>): UseLogiiTrackResult {
  const data = ref<LogiiData | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const error = ref('');

  const effectiveFileName = ref<string | null>(logiiFileName.value);

  async function reload(forceRefresh = false): Promise<void> {
    if (!trackUrlPath.value) {
      data.value = null;
      return;
    }
    isLoading.value = true;
    error.value = '';
    try {
      effectiveFileName.value = logiiFileName.value;
      const file = await readLogiiFile(trackUrlPath.value, logiiFileName.value, forceRefresh);
      if (!file) {
        data.value = { vibe: '', comments: [] };
        return;
      }
      effectiveFileName.value = file.fileName;
      data.value = parseLogii(file.content);
    } catch (err) {
      console.error('[logii] reload failed', err);
      error.value = 'Не удалось загрузить трек';
    } finally {
      isLoading.value = false;
    }
  }

  async function save(next: LogiiData): Promise<boolean> {
    isSaving.value = true;
    error.value = '';
    try {
      const content = stringifyLogii(next);
      const result = await writeLogiiFile(trackUrlPath.value, effectiveFileName.value, content);
      effectiveFileName.value = result.fileName;
      data.value = next;
      return true;
    } catch (err) {
      console.error('[logii] save failed', err);
      error.value = 'Не удалось сохранить';
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  async function appendComment(text: string): Promise<boolean> {
    if (!data.value) return false;
    const nickname = getNickname();
    if (!nickname) return false;

    const now = new Date();
    const time = now.toISOString().slice(0, 16).replace('T', ' ');

    return save({
      vibe: data.value.vibe,
      comments: [...data.value.comments, { nickname, time, text: text.trim() }],
    });
  }

  async function updateVibe(text: string): Promise<boolean> {
    if (!data.value) return false;
    return save({ vibe: text.trim(), comments: data.value.comments });
  }

  return {
    data,
    isLoading,
    isSaving,
    error,
    reload,
    appendComment,
    updateVibe,
  };
}
