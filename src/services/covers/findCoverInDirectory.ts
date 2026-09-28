// src/services/covers/findCoverInDirectory.ts

const PRIORITY = ['folder.jpg', 'folder.png', 'cover.jpg', 'cover.png']

/**
 * Ищет файл обложки в директории по приоритету имён.
 * Возвращает File или null.
 *
 * Работает с любым FileSystemDirectoryHandle.
 */
export async function findCoverInDirectory(
  dirHandle: FileSystemDirectoryHandle,
): Promise<File | null> {
  const priorityIndex = new Map(PRIORITY.map((name, i) => [name, i]))
  let best: { handle: FileSystemFileHandle; rank: number } | null = null

  for await (const entry of dirHandle.values()) {
    if (entry.kind !== 'file') continue
    const lower = entry.name.toLowerCase()
    const rank = priorityIndex.get(lower)
    if (rank === undefined) continue
    if (!best || rank < best.rank) {
      best = { handle: entry, rank }
    }
    if (rank === 0) break
  }

  if (!best) return null
  try {
    return await best.handle.getFile()
  } catch (err) {
    console.warn(`[covers] failed to read cover ${best.handle.name}`, err)
    return null
  }
}
