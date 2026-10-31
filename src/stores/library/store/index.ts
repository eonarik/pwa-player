// src/stores/library/store/index.ts

import { defineStore } from 'pinia';
import { createLibraryRefs, type LibraryRefs } from './state';
import { setupPersistence } from './persist';
import { createLibraryComputed } from './computed';
import { createLibraryActions } from './actions';
import { createLibraryCleanup } from './cleanup';
import { createLibraryReconcile } from './reconcile';

export const useLibraryStore = defineStore('library', () => {
  const refs: LibraryRefs = createLibraryRefs();

  setupPersistence(refs);

  const computed = createLibraryComputed(refs);
  const actions = createLibraryActions(refs);
  const cleanup = createLibraryCleanup(refs, computed);
  const reconcile = createLibraryReconcile(refs);

  return {
    // State (refs)
    tracks: refs.tracks,
    albums: refs.albums,
    folders: refs.folders,
    currentFolderId: refs.currentFolderId,

    // Computed
    ...computed,

    // Actions
    ...actions,

    // Cleanup
    ...cleanup,

    // Reconcile
    ...reconcile,
  };
});
