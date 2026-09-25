// src/services/persistence/historyTypes.ts

import type { PlayHistoryEntry } from '@/types/history'

export interface PersistedHistory {
  entries: PlayHistoryEntry[]
  savedAt: number
}
