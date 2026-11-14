// src/plugins/yandexSelf/logii/__tests__/logiiChangesSuppressLocalWrites.spec.ts
// CUEI-0022: штатные локальные удаления/переименования не должны давать
// removed/added события при ближайшем refresh-скане.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';

const idbStore = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => idbStore.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value);
  }),
}));

import {
  useLogiiChanges,
  markPendingDelete,
  markPendingMove,
  diffSnapshots,
  type LogiiSeasonSnapshot,
  type LogiiFileEntry,
} from '../composables/useLogiiChanges';

const SEASON = 'logii.2024-11-08';

function fileScanResult(urlPath: string, modified = 'm1', size = 10): {
  urlPath: string;
  name: string;
  ext: string;
  modified: string | null;
  size: number | undefined;
} {
  const name = urlPath.split('/').pop() ?? urlPath;
  return { urlPath, name, ext: '.txt', modified, size };
}

function entry(urlPath: string, modified = 'm1', size = 10): LogiiFileEntry {
  return { urlPath, name: urlPath.split('/').pop() ?? urlPath, ext: '.txt', modified, size };
}

function snapshotOf(entries: LogiiFileEntry[]): LogiiSeasonSnapshot {
  return { seasonUrlPath: SEASON, updatedAt: 0, files: new Map(entries.map((e) => [e.urlPath, e])) };
}

function makeChanges() {
  return useLogiiChanges({
    seasonUrlPath: ref(SEASON),
    folders: ref({}),
  });
}

async function seedSnapshot(entries: LogiiFileEntry[]): Promise<void> {
  idbStore.set(`logii:snapshot:${SEASON}`, snapshotOf(entries));
}

describe('CUEI-0022: подавление штатных локальных операций', () => {
  beforeEach(() => {
    idbStore.clear();
  });

  it('removed-событие генерируется без подавления (контроль базового поведения)', async () => {
    await seedSnapshot([entry(`${SEASON}/uA/1/vibe.txt`)]);
    const changes = makeChanges();

    const prev = await changes.readPrevSnapshot();
    await changes.initScan(prev);
    // скан не нашёл файл в папке
    changes.onAfterFolderScan(`${SEASON}/uA/1`, []);

    expect(changes.pendingEvents.value.map((e) => e.kind)).toEqual(['removed']);
  });

  it('локальное удаление папки не даёт removed и сохраняет её файлы в снимке', async () => {
    const topFiles = [entry(`${SEASON}/uA/1/vibe.txt`), entry(`${SEASON}/uA/1/song.mp3`)];
    await seedSnapshot(topFiles);
    const changes = makeChanges();

    markPendingDelete(`${SEASON}/uA/1`);

    const prev = await changes.readPrevSnapshot();
    await changes.initScan(prev);
    changes.onAfterFolderScan(`${SEASON}/uA/1`, []);
    await changes.finalizeScan(SEASON);

    expect(changes.pendingEvents.value).toHaveLength(0);

    // в новом снимке файлы штатно удалённой папки сохранены
    const after = await changes.readPrevSnapshot();
    expect([...(after?.files.keys() ?? [])].sort()).toEqual([
      `${SEASON}/uA/1/song.mp3`,
      `${SEASON}/uA/1/vibe.txt`,
    ]);
  });

  it('локальное удаление файла не даёт removed', async () => {
    await seedSnapshot([entry(`${SEASON}/uA/1/a.txt`), entry(`${SEASON}/uA/1/b.txt`)]);
    const changes = makeChanges();

    markPendingDelete(`${SEASON}/uA/1/b.txt`);

    const prev = await changes.readPrevSnapshot();
    await changes.initScan(prev);
    changes.onAfterFileScan(fileScanResult(`${SEASON}/uA/1/a.txt`));
    changes.onAfterFolderScan(`${SEASON}/uA/1`, [fileScanResult(`${SEASON}/uA/1/a.txt`)]);
    await changes.finalizeScan(SEASON);

    expect(changes.pendingEvents.value).toHaveLength(0);
  });

  it('переименование папки: скан новых путей не даёт added, старые не дают removed', async () => {
    await seedSnapshot([entry(`${SEASON}/uA/1/vibe.txt`)]);
    const changes = makeChanges();

    markPendingMove(`${SEASON}/uA/1`, `${SEASON}/uA/intro-top`);

    const prev = await changes.readPrevSnapshot();
    await changes.initScan(prev);
    // скан видит файл по новому пути
    changes.onAfterFileScan(fileScanResult(`${SEASON}/uA/intro-top/vibe.txt`));
    changes.onAfterFolderScan(`${SEASON}/uA/intro-top`, [fileScanResult(`${SEASON}/uA/intro-top/vibe.txt`)]);
    await changes.finalizeScan(SEASON);

    expect(changes.pendingEvents.value).toHaveLength(0);

    // в новом снимке файл лежит по новому пути
    const after = await changes.readPrevSnapshot();
    expect(after?.files.has(`${SEASON}/uA/intro-top/vibe.txt`)).toBe(true);
    expect(after?.files.has(`${SEASON}/uA/1/vibe.txt`)).toBe(false);

    // следующий скан чистый
    const prev2 = await changes.readPrevSnapshot();
    await changes.initScan(prev2);
    changes.onAfterFileScan(fileScanResult(`${SEASON}/uA/intro-top/vibe.txt`));
    changes.onAfterFolderScan(`${SEASON}/uA/intro-top`, [fileScanResult(`${SEASON}/uA/intro-top/vibe.txt`)]);
    expect(changes.pendingEvents.value).toHaveLength(0);
  });

  it('diffSnapshots: подавленный путь не даёт removed, обычный даёт', () => {
    markPendingDelete(`${SEASON}/uA/1/gone.txt`);

    const events = diffSnapshots(
      snapshotOf([entry(`${SEASON}/uA/1/gone.txt`), entry(`${SEASON}/uA/2/other.txt`)]),
      snapshotOf([]),
    );

    expect(events.map((e) => e.file.urlPath)).toEqual([`${SEASON}/uA/2/other.txt`]);
  });

  it('после finalizeScan повторный refresh удалённой папки не даёт removed (файлы в снимке)', async () => {
    await seedSnapshot([entry(`${SEASON}/uA/1/a.txt`)]);
    const changes = makeChanges();

    markPendingDelete(`${SEASON}/uA/1/a.txt`);
    let prev = await changes.readPrevSnapshot();
    await changes.initScan(prev);
    changes.onAfterFolderScan(`${SEASON}/uA/1`, []);
    await changes.finalizeScan(SEASON);
    expect(changes.pendingEvents.value).toHaveLength(0);

    // повторный refresh той же удалённой папки — removed не появляется,
    // потому что finalizeScan сохранил запись в снимке
    changes.clearEvents();
    prev = await changes.readPrevSnapshot();
    await changes.initScan(prev);
    changes.onAfterFolderScan(`${SEASON}/uA/1`, []);
    expect(changes.pendingEvents.value).toHaveLength(0);
  });
});
