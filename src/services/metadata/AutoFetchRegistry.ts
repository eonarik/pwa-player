// src/services/metadata/AutoFetchRegistry.ts

const processedTracks = new Set<string>();

export function isProcessed(trackId: string): boolean {
  return processedTracks.has(trackId);
}

export function markProcessed(trackId: string): void {
  processedTracks.add(trackId);
}

export function resetProcessedTrack(trackId: string): void {
  processedTracks.delete(trackId);
}
