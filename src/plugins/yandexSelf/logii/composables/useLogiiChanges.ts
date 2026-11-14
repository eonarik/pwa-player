// src/plugins/yandexSelf/logii/composables/useLogiiChanges.ts

import { ref, type Ref } from 'vue';
import { get, set } from 'idb-keyval';
import type { FolderRef } from '@/types/folder';

const SNAPSHOT_KEY_PREFIX = 'logii:snapshot:';
const LAST_SCAN_KEY_PREFIX = 'logii:lastScan:';

// --- Штатные локальные удаления и перемещения (CUEI-0022) ---

// module-level: write-хуки живут в других composable, чем скан-хуки.
// Ключ — нормализованный urlPath (как в library/scan).
// Значение: -1 = активна (подавляет), >=0 = epoch ms завершённого скана,
// который её потребил (файлы сохранены в снимке).
const pendingLocalDeletes = new Map<string, number>();
// urlPath -> epoch ms установки отметки (для TTL-фолбэка)
const deleteMarkedAt = new Map<string, number>();
const pendingLocalMoves = new Map<string, string>();

function normalizeUrlPath(p: string): string {
  return p.replace(/^\/+/, '').replace(/\/+$/, '');
}

/**
 * CUEI-0022: отметить urlPath (папку или файл) как удалённый пользователем штатно.
 * Сканы не генерируют removed для этого пути и его потомков, пока отметка
 * активна; записи сохраняются в снимке. Отметка помечается потреблённой в
 * finalizeScan и вычищается через SUPPRESS_TTL_MS (защита от протухания,
 * если снимок больше не обновляется).
 */
const SUPPRESS_TTL_MS = 10 * 60 * 1000;

export function markPendingDelete(urlPath: string): void {
  const key = normalizeUrlPath(urlPath);
  pendingLocalDeletes.set(key, -1);
  deleteMarkedAt.set(key, Date.now());
}

/** Отметить штатное перемещение (rename) поддерева oldUrlPath -> newUrlPath. */
export function markPendingMove(oldUrlPath: string, newUrlPath: string): void {
  const o = normalizeUrlPath(oldUrlPath);
  const n = normalizeUrlPath(newUrlPath);
  if (!o || !n || o === n) return;
  pendingLocalMoves.set(o, n);
  markPendingDelete(o);
}

/** true, если urlPath подавлен отметкой. */
function isDeleteSuppressed(urlPath: string): boolean {
  const p = normalizeUrlPath(urlPath);
  for (const [s] of pendingLocalDeletes) {
    if (p === s || p.startsWith(s + '/')) return true;
  }
  return false;
}

/** Если urlPath лежит в перемещённом поддереве — вернуть новый путь. */
function applyPendingMove(urlPath: string): string | null {
  const p = normalizeUrlPath(urlPath);
  for (const [o, n] of pendingLocalMoves) {
    if (p === o) return n;
    if (p.startsWith(o + '/')) return n + '/' + p.slice(o.length + 1);
  }
  return null;
}

/** Обратное отображение pendingLocalMoves: newUrlPath -> oldUrlPath. */
function movedBackPath(newUrlPath: string): string | null {
  const p = normalizeUrlPath(newUrlPath);
  for (const [o, n] of pendingLocalMoves) {
    if (p === n) return o;
    if (p.startsWith(n + '/')) return o + '/' + p.slice(n.length + 1);
  }
  return null;
}

// --- Типы снимка ---

export interface LogiiFileEntry {
  urlPath: string;
  name: string;
  ext: string;
  modified: string | null;
  size: number | undefined;
}

export interface LogiiSeasonSnapshot {
  seasonUrlPath: string;
  updatedAt: number;
  files: Map<string, LogiiFileEntry>; // urlPath -> entry
}

// --- События diff ---

export type LogiiChangeEventKind = 'added' | 'modified' | 'removed';

export interface LogiiChangeEvent {
  kind: LogiiChangeEventKind;
  file: LogiiFileEntry;
  folderUrlPath: string;
}

// --- IDB helpers ---

async function readSnapshot(seasonUrlPath: string): Promise<LogiiSeasonSnapshot | null> {
  try {
    const raw = await get<LogiiSeasonSnapshot>(`${SNAPSHOT_KEY_PREFIX}${seasonUrlPath}`);
    return raw ?? null;
  } catch {
    return null;
  }
}

async function writeSnapshot(seasonUrlPath: string, snapshot: LogiiSeasonSnapshot): Promise<void> {
  try {
    await set(`${SNAPSHOT_KEY_PREFIX}${seasonUrlPath}`, snapshot);
  } catch {
    // ignore
  }
}

async function writeLastScan(seasonUrlPath: string, ts: number): Promise<void> {
  try {
    await set(`${LAST_SCAN_KEY_PREFIX}${seasonUrlPath}`, ts);
  } catch {
    // ignore
  }
}

async function readLastScan(seasonUrlPath: string): Promise<number | null> {
  try {
    const ts = await get<number>(`${LAST_SCAN_KEY_PREFIX}${seasonUrlPath}`);
    return ts ?? null;
  } catch {
    return null;
  }
}

// --- Diff ---

function extractFileEntries(folders: FolderRef[]): LogiiFileEntry[] {
  const entries: LogiiFileEntry[] = [];
  for (const folder of folders) {
    if (!folder.files?.length) continue;
    for (const f of folder.files) {
      entries.push({
        urlPath: f.urlPath,
        name: f.name,
        ext: f.ext,
        modified: f.modified ?? null,
        size: f.size,
      });
    }
  }
  return entries;
}

export function diffSnapshots(
  prev: LogiiSeasonSnapshot | null,
  next: LogiiSeasonSnapshot,
): LogiiChangeEvent[] {
  const prevFiles = prev?.files;
  const nextFiles = next.files;
  const events: LogiiChangeEvent[] = [];

  // Собираем urlPath -> folderUrlPath (берем из urlPath самого файла)
  for (const [, entry] of nextFiles) {
    const folderUrlPath = entry.urlPath.split('/').slice(0, -1).join('/');
    const prevEntry = prevFiles?.get(entry.urlPath);

    if (!prevEntry) {
      events.push({ kind: 'added', file: entry, folderUrlPath });
    } else if (prevEntry.modified !== entry.modified || prevEntry.size !== entry.size) {
      events.push({ kind: 'modified', file: entry, folderUrlPath });
    }
  }

  // Удалённые
  if (prevFiles) {
    for (const [, entry] of prevFiles) {
      // CUEI-0022: локальные штатные удаления не должны становиться removed
      if (isDeleteSuppressed(entry.urlPath)) continue;
      if (!nextFiles.has(entry.urlPath)) {
        const folderUrlPath = entry.urlPath.split('/').slice(0, -1).join('/');
        events.push({ kind: 'removed', file: entry, folderUrlPath });
      }
    }
  }

  return events;
}

// --- Composable ---

export interface UseLogiiChangesDeps {
  seasonUrlPath: Ref<string>;
  folders: Ref<Record<string, FolderRef>>;
}

export interface LogiiChangesResult {
  isSyncing: Ref<boolean>;
  pendingEvents: Ref<LogiiChangeEvent[]>;
  unreadCount: Ref<number>;
  /** Применить результат скана: построить снимок, diff, сохранить. */
  applyScanResult: () => void;
  /** Применить изменение текста (из readLogiiFile) без скана. */
  applyTextChange: (remotePath: string, modified: string | null) => void;
  /** Сбросить события. */
  clearEvents: () => void;
  /** Проверить: есть ли сканы/загрузки новее последнего снимка. */
  isScanPending: () => Promise<boolean>;
  /** Колбэк скана: файл обработан (итеративный diff). */
  onAfterFileScan: (file: import('@/plugins/yandexDisk/scan').FileScanResult) => void;
  /** Колбэк скана: все файлы папки обработаны. */
  onAfterFolderScan: (
    folderUrlPath: string,
    scannedFiles: Array<{ urlPath: string; modified: string | null; size: number | undefined }>,
  ) => void;
  /** Инициализировать состояние для итеративного diff перед сканом. */
  initScan: (prevSnapshot: LogiiSeasonSnapshot | null) => Promise<void>;
  /** Финализировать скан: обновить снимок с удалёнными файлами. */
  finalizeScan: (seasonUrlPath: string) => Promise<void>;
  /** Прочитать предыдущий снимок из IDB. */
  readPrevSnapshot: () => Promise<LogiiSeasonSnapshot | null>;
}

export function useLogiiChanges(deps: UseLogiiChangesDeps): LogiiChangesResult {
  const isSyncing = ref(false);
  const pendingEvents = ref<LogiiChangeEvent[]>([]);
  const unreadCount = ref(0);

  // Состояние для итеративного diff во время скана
  let prevSnapshotForScan: LogiiSeasonSnapshot | null = null;
  // false при первом скане (prev пуст) — не генерируем added для начальной индексации
  let hasPrevFiles = false;
  const scannedUrlPathsInRun = new Set<string>();
  const scannedFilesMap = new Map<string, LogiiFileEntry>();
  // CUEI-0022: какие urlPath были подавлены в текущем скане (штатные удаления)
  let suppressedInRun: string[] = [];

  async function initScan(prevSnapshot: LogiiSeasonSnapshot | null): Promise<void> {
    // CUEI-0022: forget протухших отметок (не дождались завершённого скана)
    const cutoff = Date.now() - SUPPRESS_TTL_MS;
    const staleKeys: string[] = [];
    pendingLocalDeletes.forEach((consumedAt, key) => {
      const markedAt = deleteMarkedAt.get(key) ?? 0;
      if ((consumedAt !== -1 && consumedAt < cutoff) || markedAt < cutoff) {
        staleKeys.push(key);
      }
    });
    for (const key of staleKeys) {
      pendingLocalDeletes.delete(key);
      deleteMarkedAt.delete(key);
    }

    prevSnapshotForScan = prevSnapshot;
    // hasPrevFiles: скан уже завершался для этого сезона (есть lastScan).
    // processSnapshot может записать snapshot до первого скана — тогда diff
    // даст ложные added для файлов, которых ещё не было в библиотеке.
    const lastScan = await readLastScan(deps.seasonUrlPath.value);
    hasPrevFiles = lastScan !== null;
    scannedUrlPathsInRun.clear();
    scannedFilesMap.clear();
    // Снимок до скана содержит штатно удалённые пути — запоминаем их,
    // чтобы finalizeScan вернул их в новый снимок
    suppressedInRun =
      prevSnapshot && pendingLocalDeletes.size > 0
        ? [...prevSnapshot.files.keys()].filter((p) => isDeleteSuppressed(p))
        : [];
  }

  function pushEvent(event: LogiiChangeEvent): void {
    const next = [...pendingEvents.value, event];
    // Сортировка: новые modified первыми; без modified — в конец
    next.sort((a, b) => {
      const am = a.file.modified ?? '';
      const bm = b.file.modified ?? '';
      return bm.localeCompare(am);
    });
    pendingEvents.value = next;
    unreadCount.value = next.length;
  }

  function onAfterFileScan(file: import('@/plugins/yandexDisk/scan').FileScanResult): void {
    if (!prevSnapshotForScan) return;

    scannedUrlPathsInRun.add(file.urlPath);
    scannedFilesMap.set(file.urlPath, {
      urlPath: file.urlPath,
      name: file.name,
      ext: file.ext,
      modified: file.modified,
      size: file.size,
    });

    const prevEntry = prevSnapshotForScan.files.get(file.urlPath);
    const fileEntry = scannedFilesMap.get(file.urlPath)!;

    const folderUrlPath = file.urlPath.split('/').slice(0, -1).join('/');

    if (!prevEntry && hasPrevFiles) {
      // CUEI-0022: файл на месте штатного перемещения — не added
      const oldPath = prevSnapshotForScan ? movedBackPath(file.urlPath) : null;
      if (oldPath && prevSnapshotForScan.files.has(oldPath)) {
        // перемещённый файл: не added, сверяем modified как с prevEntry
        const movedPrev = prevSnapshotForScan.files.get(oldPath)!;
        if (
          movedPrev.modified !== null &&
          (movedPrev.modified !== fileEntry.modified || movedPrev.size !== fileEntry.size)
        ) {
          pushEvent({ kind: 'modified', file: fileEntry, folderUrlPath });
        }
        return;
      }
      pushEvent({ kind: 'added', file: fileEntry, folderUrlPath });
    } else if (hasPrevFiles && prevEntry &&
      prevEntry.modified !== null &&
      (prevEntry.modified !== file.modified || prevEntry.size !== file.size)
    ) {
      pushEvent({ kind: 'modified', file: fileEntry, folderUrlPath });
    }
  }

  function onAfterFolderScan(
    folderUrlPath: string,
    _scannedFiles: Array<{ urlPath: string; modified: string | null; size: number | undefined }>,
  ): void {
    if (!prevSnapshotForScan) return;

    // CUEI-0022: скан удалённой штатно папки не генерирует removed для её содержимого
    if (isDeleteSuppressed(folderUrlPath)) return;

    // scannedUrlPathsInRun наполняется в onAfterFileScan для ВСЕХ файлов
    // (включая аудио); scannedFiles из scan.ts содержит только не-аудио
    for (const [urlPath, entry] of prevSnapshotForScan.files) {
      const fileFolder = urlPath.split('/').slice(0, -1).join('/');
      if (fileFolder === folderUrlPath && !scannedUrlPathsInRun.has(urlPath) && !isDeleteSuppressed(urlPath)) {
        pendingEvents.value = [...pendingEvents.value, { kind: 'removed', file: entry, folderUrlPath }];
        unreadCount.value = pendingEvents.value.length;
      }
    }
  }

  async function finalizeScan(seasonUrlPath: string): Promise<void> {
    if (!prevSnapshotForScan) return;

    // Новый снимок = все файлы, найденные при этом скане
    const updatedFiles = new Map(scannedFilesMap);

    // CUEI-0022: finalizeScan сохраняет удалённые/перемещённые записи в новом
    // снимке, чтобы повторный refresh не выдал их как removed (файл физически
    // удалён, prev его не содержит -> removed не генерируется).
    // Для перемещений переносим запись под новый путь.
    for (const urlPath of suppressedInRun) {
      const entry = prevSnapshotForScan.files.get(urlPath);
      if (!entry) continue;
      const moved = applyPendingMove(urlPath);
      if (moved) {
        // перемещённый файл уже сканировался под новым путём (scannedFilesMap) —
        // не перетирать свежие modified/size
        if (!updatedFiles.has(moved)) updatedFiles.set(moved, { ...entry, urlPath: moved });
      } else if (!updatedFiles.has(urlPath)) {
        updatedFiles.set(urlPath, entry);
      }
    }

    await writeSnapshot(seasonUrlPath, {
      seasonUrlPath,
      updatedAt: Date.now(),
      files: updatedFiles,
    });

    prevSnapshotForScan = null;
    // CUEI-0022: снимок обновлён — подавления потреблены, помечаем consumed
    // (все ещё активные отметки). Вычистятся по TTL в initScan.
    const consumedNow = Date.now();
    for (const [key, consumedAt] of pendingLocalDeletes) {
      if (consumedAt === -1) pendingLocalDeletes.set(key, consumedNow);
    }
    suppressedInRun = [];
    // Перемещения применены к снимку — снимаем их полностью.
    // Если finalize не выполнится (скан упал), moves останутся в
    // pendingLocalMoves и будут применены в следующем скане.
    pendingLocalMoves.clear();
  }

  function buildSnapshot(seasonUrlPath: string): LogiiSeasonSnapshot | null {
    const folders = deps.folders.value;
    // Собираем только папки, urlPath которых начинается с seasonUrlPath
    const seasonPrefix = seasonUrlPath.replace(/^\/+/, '').replace(/\/+$/, '');
    const seasonFolders: FolderRef[] = [];

    for (const f of Object.values(folders)) {
      if (f.pluginId !== 'yandex-self') continue;
      const fUrlPath = f.urlPath.replace(/^\/+/, '');
      if (!seasonPrefix) {
        // Корневая папка сезона
        seasonFolders.push(f);
      } else if (fUrlPath === seasonPrefix || fUrlPath.startsWith(seasonPrefix + '/')) {
        seasonFolders.push(f);
      }
    }

    if (seasonFolders.length === 0) return null;

    const files = new Map<string, LogiiFileEntry>();
    for (const entry of extractFileEntries(seasonFolders)) {
      files.set(entry.urlPath, entry);
    }

    return { seasonUrlPath, updatedAt: Date.now(), files };
  }

  function applyScanResult(): void {
    // Если был запущен итеративный скан — снимок уже обновлён в finalizeScan,
    // события накоплены через onAfterFileScan/onAfterFolderScan.
    if (prevSnapshotForScan !== null) {
      return;
    }

    const seasonUrlPath = deps.seasonUrlPath.value;
    if (!seasonUrlPath) return;

    const snapshot = buildSnapshot(seasonUrlPath);
    if (!snapshot) return;

    void processSnapshot(snapshot);
  }

  function applyTextChange(remotePath: string, modified: string | null): void {
    const seasonUrlPath = deps.seasonUrlPath.value;
    if (!seasonUrlPath) return;

    void processTextChange(seasonUrlPath, remotePath, modified);
  }

  async function processSnapshot(snapshot: LogiiSeasonSnapshot): Promise<void> {
    isSyncing.value = true;
    try {
      const prev = await readSnapshot(snapshot.seasonUrlPath);
      if (!prev) {
        // Первый снимок — просто сохраняем, не спамим событиями
        await writeSnapshot(snapshot.seasonUrlPath, snapshot);
        await writeLastScan(snapshot.seasonUrlPath, snapshot.updatedAt);
        return;
      }

      const events = diffSnapshots(prev, snapshot);
      if (events.length > 0) {
        pendingEvents.value = events;
        unreadCount.value = events.length;
      }

      // CUEI-0022: processSnapshot строит снимок из библиотеки, где штатно
      // удалённых файлов уже нет. Снимок сохраняется БЕЗ них — при следующем
      // refresh-скане их тоже не будет в prev, и removed не появится.
      // Forget подавленных отметок: они потреблены этим обновлением снимка.
      pendingLocalDeletes.clear();
      pendingLocalMoves.clear();

      await writeSnapshot(snapshot.seasonUrlPath, snapshot);
      await writeLastScan(snapshot.seasonUrlPath, snapshot.updatedAt);
    } finally {
      isSyncing.value = false;
    }
  }

  async function processTextChange(
    seasonUrlPath: string,
    remotePath: string,
    modified: string | null,
  ): Promise<void> {
    try {
      const prev = await readSnapshot(seasonUrlPath);
      if (!prev) return;

      const prevEntry = prev.files.get(remotePath);
      if (prevEntry && prevEntry.modified === modified) return;

      const entry: LogiiFileEntry = {
        urlPath: remotePath,
        name: remotePath.split('/').pop() ?? '',
        ext: '.' + (remotePath.split('.').pop() ?? ''),
        modified,
        size: prevEntry?.size,
      };

      const events: LogiiChangeEvent[] = [];
      if (prevEntry && (prevEntry.modified !== modified)) {
        events.push({ kind: 'modified', file: entry, folderUrlPath: remotePath.split('/').slice(0, -1).join('/') });
      } else if (!prevEntry) {
        events.push({ kind: 'added', file: entry, folderUrlPath: remotePath.split('/').slice(0, -1).join('/') });
      }

      if (events.length > 0) {
        pendingEvents.value = [...pendingEvents.value, ...events];
        unreadCount.value = pendingEvents.value.length;
      }

      // Обновляем снимок
      const updatedFiles = new Map(prev.files);
      updatedFiles.set(remotePath, entry);
      await writeSnapshot(seasonUrlPath, { ...prev, files: updatedFiles });
    } catch {
      // ignore
    }
  }

  function clearEvents(): void {
    pendingEvents.value = [];
    unreadCount.value = 0;
  }

  async function isScanPending(): Promise<boolean> {
    const seasonUrlPath = deps.seasonUrlPath.value;
    if (!seasonUrlPath) return false;
    const lastScan = await readLastScan(seasonUrlPath);
    if (!lastScan) return true;
    const now = Date.now();
    const sixHours = 6 * 60 * 60 * 1000;
    return now - lastScan > sixHours;
  }

  async function readPrevSnapshot(): Promise<LogiiSeasonSnapshot | null> {
    return readSnapshot(deps.seasonUrlPath.value);
  }

  return {
    isSyncing,
    pendingEvents,
    unreadCount,
    initScan,
    onAfterFileScan,
    onAfterFolderScan,
    finalizeScan,
    readPrevSnapshot,
    applyScanResult,
    applyTextChange,
    clearEvents,
    isScanPending,
  };
}
