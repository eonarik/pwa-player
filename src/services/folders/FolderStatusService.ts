// src/services/folders/FolderStatusService.ts

import { reactive, readonly } from 'vue';
import type { FolderId } from '@/types/ids';
import type { FolderScanStatus, FolderStatusEntry } from './types';

const STORAGE_KEY = 'player:folderStatuses';
const STORAGE_VERSION = 1;

interface PersistedShape {
  v: number;
  entries: Record<string, FolderStatusEntry>;
}

class FolderStatusServiceImpl {
  private static instance: FolderStatusServiceImpl | null = null;
  private entries = reactive<Record<string, FolderStatusEntry>>({});
  private loaded = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly SAVE_DEBOUNCE_MS = 300;

  static getInstance(): FolderStatusServiceImpl {
    if (!FolderStatusServiceImpl.instance) {
      FolderStatusServiceImpl.instance = new FolderStatusServiceImpl();
    }
    return FolderStatusServiceImpl.instance;
  }

  get state() {
    return readonly(this.entries);
  }

  getStatus(folderId: FolderId): FolderScanStatus | null {
    this.ensureLoaded();
    return this.entries[folderId]?.status ?? null;
  }

  getEntry(folderId: FolderId): FolderStatusEntry | null {
    this.ensureLoaded();
    return this.entries[folderId] ?? null;
  }

  needsScan(folderId: FolderId): boolean {
    return this.getStatus(folderId) === 'pending';
  }

  isScanning(folderId: FolderId): boolean {
    return this.getStatus(folderId) === 'scanning';
  }

  isScanned(folderId: FolderId): boolean {
    return this.getStatus(folderId) === 'scanned';
  }

  isError(folderId: FolderId): boolean {
    return this.getStatus(folderId) === 'error';
  }

  register(folderId: FolderId, status: FolderScanStatus = 'pending'): void {
    this.ensureLoaded();
    if (this.entries[folderId]) return;
    this.setEntry(folderId, { status, updatedAt: Date.now() });
  }

  markScanning(folderId: FolderId): void {
    this.ensureLoaded();
    this.setEntry(folderId, { status: 'scanning', updatedAt: Date.now() });
  }

  markScanned(folderId: FolderId): void {
    this.ensureLoaded();
    this.setEntry(folderId, { status: 'scanned', updatedAt: Date.now() });
  }

  markPending(folderId: FolderId): void {
    this.ensureLoaded();
    this.setEntry(folderId, { status: 'pending', updatedAt: Date.now() });
  }

  markError(folderId: FolderId, errorMessage?: string): void {
    this.ensureLoaded();
    this.setEntry(folderId, { status: 'error', updatedAt: Date.now(), errorMessage });
  }

  // --- Массовые операции ---

  markErrorMany(folderIds: FolderId[], errorMessage: string): void {
    this.ensureLoaded();
    let changed = false;
    for (const id of folderIds) {
      if (this.entries[id]) {
        this.entries[id] = { status: 'error', updatedAt: Date.now(), errorMessage };
        changed = true;
      }
    }
    if (changed) this.scheduleSave();
  }

  forget(folderId: FolderId): void {
    this.ensureLoaded();
    if (!this.entries[folderId]) return;
    delete this.entries[folderId];
    this.scheduleSave();
  }

  forgetMany(folderIds: FolderId[]): void {
    this.ensureLoaded();
    let changed = false;
    for (const id of folderIds) {
      if (this.entries[id]) {
        delete this.entries[id];
        changed = true;
      }
    }
    if (changed) this.scheduleSave();
  }

  clear(): void {
    for (const key of Object.keys(this.entries)) {
      delete this.entries[key];
    }
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  flush(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.persist();
  }

  private setEntry(folderId: FolderId, entry: FolderStatusEntry): void {
    this.entries[folderId] = entry;
    this.scheduleSave();
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedShape;
      if (!parsed || parsed.v !== STORAGE_VERSION || !parsed.entries) return;

      for (const [id, entry] of Object.entries(parsed.entries)) {
        if (!entry || typeof entry.status !== 'string') continue;
        // Фоллбэк: если вкладку закрыли во время скана, при следующем открытии
        // конвертируем scanning в pending, чтобы можно было досканировать.
        if (entry.status === 'scanning') {
          entry.status = 'pending';
        }
        this.entries[id] = entry;
      }
    } catch (err) {
      console.warn('[folderStatus] failed to load from localStorage', err);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.persist();
    }, this.SAVE_DEBOUNCE_MS);
  }

  private persist(): void {
    try {
      const entries: Record<string, FolderStatusEntry> = {};
      for (const [id, entry] of Object.entries(this.entries)) {
        entries[id] = entry;
      }
      const payload: PersistedShape = { v: STORAGE_VERSION, entries };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('[folderStatus] failed to persist', err);
    }
  }
}

export const folderStatusService = FolderStatusServiceImpl.getInstance();
