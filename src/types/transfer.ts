// src/types/transfer.ts

/**
 * Состояние transfer-операции (скачивание / удаление) для трека.
 *
 * Живёт в `DownloadOrchestrator`, не в `track`. UI читает через
 * `orchestrator.getTransferState(trackId)`.
 */
export type TransferState =
  | { kind: 'idle' }
  | {
      kind: 'downloading'
      written: number
      total: number
      abort: AbortController
    }
  | {
      kind: 'deleting'
      abort: AbortController
    }
