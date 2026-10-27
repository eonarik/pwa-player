// src/plugins/yandexDisk/sync.ts

import type { PluginContext, ScanResult } from '../types'
import type { LibraryTrack, Folder, CollectedLibrary, MetadataSource } from '@/types/library'
import { scanDirectory } from '@/services/download/scanDirectory'
import { getFileHandleFromPath } from '@/services/download/getFileFromPath'
import { parseTrackMetadata } from '@/services/metadata/parseTrackMetadata'
import { trackIdFromPath, folderIdFromPath } from '@/services/library/id'
import { findNearestFolder } from './scan'
import { isAudioFile } from '@/shared/audioExtensions'

export interface SyncDeps {
  sourceId: string
}

function isLocallyAvailable(track: LibraryTrack | null): boolean {
  if (!track) return false
  const loc = track.fileLocation ?? 'remote-only'
  return loc === 'local-only' || loc === 'both'
}

export async function scanDownloadDirForSource(
  deps: SyncDeps,
  context: PluginContext,
  targetDir: FileSystemDirectoryHandle,
): Promise<ScanResult> {
  const files = await scanDirectory(targetDir)
  const allTracks = context.writer.getTracksBySource(deps.sourceId)

  const byPath = new Map<string, LibraryTrack>()
  for (const track of allTracks) {
    const path = track.path ?? track.filename
    if (path) byPath.set(path, track) // <-- проверка на undefined
  }

  const downloaded = new Map<string, string>()
  const matchedPaths = new Set<string>()

  for (const filePath of files.keys()) {
    const track = byPath.get(filePath)
    if (track) {
      downloaded.set(track.id, filePath)
      matchedPaths.add(filePath)
    }
  }

  const onlyLocal: Array<{ relativePath: string; filename: string }> = []
  for (const [filePath, file] of files) {
    if (matchedPaths.has(filePath)) continue
    onlyLocal.push({ relativePath: filePath, filename: file.handle.name })
  }

  const missing: string[] = []
  for (const track of allTracks) {
    if (!isLocallyAvailable(track)) continue
    const path = track.path ?? track.filename
    if (!path || !files.has(path)) missing.push(track.id) // <-- проверка
  }

  return { downloaded, onlyLocal, missing }
}

export async function createLocalTrackFromFile(
  deps: SyncDeps,
  context: PluginContext,
  relativePath: string,
  filename: string,
): Promise<LibraryTrack | null> {
  const trackId = trackIdFromPath(deps.sourceId, relativePath)
  if (context.writer.getTrack(trackId)) return null

  const targetDir = await context.getDownloadDir()
  if (!targetDir) return null

  const fileHandle = await getFileHandleFromPath(targetDir, relativePath)
  if (!fileHandle) return null

  const file = await fileHandle.getFile()

  const folder = findNearestFolder(context.writer, deps.sourceId, relativePath)
  if (!folder) return null

  const metadata = await parseTrackMetadata(file, {})
  const hasRealTags = Boolean(metadata.artist)

  return {
    id: trackId,
    pluginId: deps.sourceId,
    folderId: folder.id,
    filename,
    path: relativePath,
    handle: fileHandle,
    source: '',
    fileLocation: 'local-only',
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album, // Берем только из парсера (или пустой)
    duration: metadata.duration,
    coverUrl: metadata.coverUrl,
    metaSource: hasRealTags ? 'file' : 'filename',
  }
}

export async function restoreLibraryFromFiles(
  deps: SyncDeps,
  context: PluginContext,
  targetDir: FileSystemDirectoryHandle,
): Promise<boolean> {
  const files = await scanDirectory(targetDir)
  if (files.size === 0) return false

  const rootFolderId = folderIdFromPath(deps.sourceId, '')
  const rootFolder: Folder = {
    id: rootFolderId,
    name: 'Скачанные треки',
    parentId: null,
    path: '',
    childFolderIds: [],
    trackIds: [],
    totalTrackCount: 0,
    source: deps.sourceId,
    scanState: 'scanned',
  }

  const foldersMap = new Map<string, Folder>()
  foldersMap.set('', rootFolder)

  const sortedPaths = Array.from(files.keys()).sort()

  for (const relativePath of sortedPaths) {
    const segments = relativePath.split('/')
    const filename = segments.pop()!
    if (!isAudioFile(filename)) continue

    let parentPath = ''
    let parentId = rootFolderId

    for (const seg of segments) {
      const currentPath = parentPath ? `${parentPath}/${seg}` : seg
      const folderId = folderIdFromPath(deps.sourceId, currentPath)

      if (!foldersMap.has(currentPath)) {
        const folder: Folder = {
          id: folderId,
          name: seg,
          parentId,
          path: currentPath,
          childFolderIds: [],
          trackIds: [],
          totalTrackCount: 0,
          source: deps.sourceId,
          scanState: 'scanned',
        }
        foldersMap.set(currentPath, folder)
        const parentFolder = foldersMap.get(parentPath)!
        parentFolder.childFolderIds.push(folderId)
      }
      parentPath = currentPath
      parentId = folderId
    }

    const trackId = trackIdFromPath(deps.sourceId, relativePath)
    const folder = foldersMap.get(segments.join('/')) || rootFolder

    if (!folder.trackIds.includes(trackId)) {
      folder.trackIds.push(trackId)
    }
  }

  const sortedFolders = Array.from(foldersMap.values()).sort(
    (a, b) => b.path.length - a.path.length,
  )
  for (const folder of sortedFolders) {
    folder.totalTrackCount = folder.trackIds.length
    if (folder.parentId) {
      const parent = Array.from(foldersMap.values()).find((f) => f.id === folder.parentId)
      if (parent) parent.totalTrackCount += folder.totalTrackCount
    }
  }

  const allTracks: LibraryTrack[] = []
  for (const folder of foldersMap.values()) {
    for (const trackId of folder.trackIds) {
      const trackPath = Array.from(files.keys()).find(
        (p) => trackIdFromPath(deps.sourceId, p) === trackId,
      )
      if (!trackPath) continue

      const fileHandle = files.get(trackPath)!.handle
      const file = await fileHandle.getFile()

      const existing = context.writer.getTrack(trackId)
      const metadata = await parseTrackMetadata(file, {})
      const hasRealTags = Boolean(metadata.artist)

      const metaSource: MetadataSource =
        existing?.metaSource === 'manual' ? 'manual' : hasRealTags ? 'file' : 'filename'

      allTracks.push({
        id: trackId,
        pluginId: deps.sourceId,
        folderId: folder.id,
        filename: trackPath.split('/').pop()!,
        path: trackPath,
        remotePath: existing?.remotePath ?? `disk:${trackPath}`,
        handle: fileHandle,
        source: '',
        fileLocation: 'local-only',
        title:
          existing?.metaSource === 'manual'
            ? existing.title
            : metadata.title || existing?.title || '',
        artist:
          existing?.metaSource === 'manual'
            ? existing.artist
            : metadata.artist || existing?.artist || '',
        album:
          existing?.metaSource === 'manual'
            ? existing.album
            : metadata.album || existing?.album || '',
        coverUrl: existing?.coverUrl || metadata.coverUrl,
        metaSource,
        duration: metadata.duration,
      })
    }
  }

  const collected: CollectedLibrary = {
    folders: Array.from(foldersMap.values()),
    tracks: allTracks,
    rootFolderId,
    rootFolderName: 'Скачанные треки',
  }

  context.writer.setLibrary(collected, deps.sourceId)
  return true
}

export async function mergeLocalIntoLibrary(
  deps: SyncDeps,
  context: PluginContext,
  targetDir: FileSystemDirectoryHandle,
): Promise<void> {
  const files = await scanDirectory(targetDir)
  if (files.size === 0) return

  const rootFolderId = folderIdFromPath(deps.sourceId, '')
  const rootFolder = context.writer.getFolder(rootFolderId)
  if (!rootFolder) {
    console.warn(`[${deps.sourceId}] mergeLocalIntoLibrary: no root folder in library`)
    return
  }

  const createdFolders: Folder[] = []
  const createdTracks: LibraryTrack[] = []
  const createdFolderIds = new Set<string>()
  let updatedCount = 0

  const sortedPaths = Array.from(files.keys()).sort()

  for (const relativePath of sortedPaths) {
    const segments = relativePath.split('/')
    const filename = segments.pop()
    if (!filename) continue
    if (!isAudioFile(filename)) continue

    let parentId = rootFolderId
    let currentPath = ''
    for (const seg of segments) {
      currentPath = currentPath ? `${currentPath}/${seg}` : seg
      const folderId = folderIdFromPath(deps.sourceId, currentPath)
      const existingFolder = context.writer.getFolder(folderId)
      if (!existingFolder && !createdFolderIds.has(folderId)) {
        const folder: Folder = {
          id: folderId,
          name: seg,
          parentId,
          path: currentPath,
          childFolderIds: [],
          trackIds: [],
          totalTrackCount: 0,
          source: deps.sourceId,
          scanState: 'scanned',
        }
        createdFolders.push(folder)
        createdFolderIds.add(folderId)
      }
      parentId = folderId
    }

    const trackId = trackIdFromPath(deps.sourceId, relativePath)
    const existingTrack = context.writer.getTrack(trackId)
    const fileHandle = files.get(relativePath)!.handle

    if (existingTrack) {
      context.writer.updateTrackHandle(trackId, fileHandle)
      context.writer.updateTrackFileLocation(trackId, 'both')
      context.writer.updateTrackSource(trackId, '')
      updatedCount++
      continue
    }

    let file: File
    try {
      file = await fileHandle.getFile()
    } catch (err) {
      console.warn(`[${deps.sourceId}] merge: can't read "${relativePath}"`, err)
      continue
    }

    const parsed = await parseTrackMetadata(file, {})
    const hasRealTags = Boolean(parsed.artist)

    createdTracks.push({
      id: trackId,
      pluginId: deps.sourceId,
      folderId: parentId,
      filename,
      path: relativePath,
      remotePath: `disk:${relativePath}`,
      handle: fileHandle,
      source: '',
      fileLocation: 'local-only',
      title: parsed.title,
      artist: parsed.artist,
      album: parsed.album, // Берем только из парсера (или пустой)
      duration: parsed.duration,
      coverUrl: parsed.coverUrl,
      metaSource: hasRealTags ? 'file' : 'filename',
    })
  }

  if (createdFolders.length > 0) {
    context.writer.addFolders(createdFolders, deps.sourceId)

    const byParent = new Map<string, string[]>()
    for (const folder of createdFolders) {
      if (!folder.parentId) continue
      const list = byParent.get(folder.parentId) ?? []
      list.push(folder.id)
      byParent.set(folder.parentId, list)
    }
    for (const [parentId, childIds] of byParent) {
      const parent = context.writer.getFolder(parentId)
      if (!parent) continue
      const merged = Array.from(new Set([...parent.childFolderIds, ...childIds]))
      context.writer.updateFolder(parentId, { childFolderIds: merged })
    }
  }

  if (createdTracks.length > 0) {
    context.writer.addTracks(createdTracks, deps.sourceId)
  }

  console.info(
    `[${deps.sourceId}] mergeLocalIntoLibrary done: files=${files.size}, updated=${updatedCount}, created=${createdTracks.length}`,
  )
}
