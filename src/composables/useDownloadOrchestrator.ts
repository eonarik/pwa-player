// src/composables/useDownloadOrchestrator.ts
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator'

export function useDownloadOrchestrator() {
  return downloadOrchestrator
}
