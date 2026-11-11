// src/services/metadata/MetadataService/apply/index.ts

import type { MetadataPersistence } from '../persistence';
import { createRemoteApply } from './remote';
import { createId3Apply } from './id3';
import { createManualApply } from './manual';
import { createCandidateApply } from './candidate';
import { applyDuplicates, pickPrimaryTrackId } from './duplicates';

/**
 * Модуль применения метаданных. Собирает из подмодулей единый API:
 * `applyRemote`, `applyPatch`, `applyFromFile`, `updateManual`,
 * `applyCandidate`, `invokeApplyCandidate`, `applyDuplicates`.
 *
 * Все функции используют общую среду: `persistence`, `useLibraryStore`,
 * `createLibraryWriter`, `eventBus` — каждый подмодуль импортирует
 * только то, что ему нужно.
 */
export function createMetadataApply(persistence: MetadataPersistence) {
  const manual = createManualApply(persistence);
  const remote = createRemoteApply(persistence);
  const id3 = createId3Apply(persistence);
  const candidate = createCandidateApply(manual);

  return {
    applyRemote: remote.applyRemote,
    applyPatch: remote.applyPatch,
    applyFromFile: id3.applyFromFile,
    updateManual: manual.updateManual,
    applyCandidate: candidate.applyCandidate,
    invokeApplyCandidate: candidate.invokeApplyCandidate,
    applyDuplicates,
    pickPrimaryTrackId,
  };
}

export type MetadataApply = ReturnType<typeof createMetadataApply>;
