// src/globals.d.ts

/* eslint-disable @typescript-eslint/no-explicit-any */

/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

import type { Buffer as BufferType } from 'buffer';
import type processType from 'process';
import type { useLibraryStore } from '@/stores/library';
import type { usePlayerStore } from '@/stores/player';
import type { usePlaylistsStore } from '@/stores/playlists';
import type { useHistoryStore } from '@/stores/history';
import type { useDislikesStore } from '@/stores/dislikes';
import type { downloadOrchestrator } from '@/services/download/DownloadOrchestrator';
import type { syncService } from '@/services/download/SyncService';
import type { downloadSpaceService } from '@/services/download/DownloadSpaceService';

declare module '*.css' {
  const content: string;
  export default content;
}
declare module '*.scss' {
  const content: string;
  export default content;
}

declare module 'virtual:__federation__' {
  export function __federation_method_setRemote(name: string, config: any): void;
  export function __federation_method_getRemote(name: string, module: string): Promise<any>;
  export function __federation_method_unwrapDefault(module: any): any;
}

declare global {
  const __APP_VERSION__: string;
  const __BUILD_HASH__: string;

  interface Window {
    global: typeof globalThis;
    Buffer: typeof BufferType;
    process: typeof processType;

    __library?: typeof useLibraryStore;
    __player?: typeof usePlayerStore;
    __downloads?: typeof downloadOrchestrator;
    __sync?: typeof syncService;
    __space?: typeof downloadSpaceService;
    __playlists?: typeof usePlaylistsStore;
    __history?: typeof useHistoryStore;
    __dislikes?: typeof useDislikesStore;
    __countNodes?: () => number;
  }
}

export {};
