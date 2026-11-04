// src/utils/folderStatus.ts

import type { FolderRef, FolderScanProgress, FolderScanState } from '@/types/folder';

export function getFolderScanState(folder: FolderRef | null | undefined): FolderScanState | null {
  return folder?.scanState ?? null;
}

export function isScanning(folder: FolderRef | null | undefined): boolean {
  return getFolderScanState(folder) === 'scanning';
}

export function isPending(folder: FolderRef | null | undefined): boolean {
  return getFolderScanState(folder) === 'pending';
}

export function isScanned(folder: FolderRef | null | undefined): boolean {
  return getFolderScanState(folder) === 'scanned';
}

export function isError(folder: FolderRef | null | undefined): boolean {
  return getFolderScanState(folder) === 'error';
}

export function needsScan(folder: FolderRef | null | undefined): boolean {
  return isPending(folder) || getFolderScanState(folder) === null;
}

export function getProgress(folder: FolderRef | null | undefined): FolderScanProgress | null {
  return folder?.scanProgress ?? null;
}

export function getErrorMessage(folder: FolderRef | null | undefined): string | null {
  return folder?.scanError ?? null;
}
