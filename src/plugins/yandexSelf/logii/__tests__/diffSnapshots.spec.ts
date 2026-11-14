// src/plugins/yandexSelf/logii/__tests__/diffSnapshots.spec.ts

import { describe, it, expect } from 'vitest';
import { diffSnapshots } from '../composables/useLogiiChanges';
import type { LogiiSeasonSnapshot, LogiiFileEntry } from '../composables/useLogiiChanges';

function entry(urlPath: string, modified: string | null = null, size?: number): LogiiFileEntry {
  return {
    urlPath,
    name: urlPath.split('/').pop() ?? urlPath,
    ext: urlPath.split('.').pop() ?? '',
    modified,
    size,
  };
}

function snap(entries: LogiiFileEntry[]): LogiiSeasonSnapshot {
  return {
    seasonUrlPath: '/logii/2024',
    updatedAt: 0,
    files: new Map(entries.map((e) => [e.urlPath, e])),
  };
}

describe('diffSnapshots (CUEI-0012)', () => {
  it('первый снимок даёт только added', () => {
    const events = diffSnapshots(null, snap([entry('/a/new.mp3', 'm1', 10)]));
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('added');
    expect(events[0]?.file.urlPath).toBe('/a/new.mp3');
    expect(events[0]?.folderUrlPath).toBe('/a');
  });

  it('modified: изменились modified или size', () => {
    const events = diffSnapshots(
      snap([entry('/v/vibe.logii.txt', 'm1', 5)]),
      snap([entry('/v/vibe.logii.txt', 'm2', 7)]),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('modified');
  });

  it('removed: файл исчез', () => {
    const events = diffSnapshots(snap([entry('/g/gone.png')]), snap([]));
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('removed');
    expect(events[0]?.file.urlPath).toBe('/g/gone.png');
  });

  it('идентичные снимки не дают событий', () => {
    const a = snap([entry('/x.mp3', 'm', 1)]);
    const b = snap([entry('/x.mp3', 'm', 1)]);
    expect(diffSnapshots(a, b)).toEqual([]);
  });

  it('смешанный diff даёт все три типа', () => {
    const events = diffSnapshots(
      snap([
        entry('/k/keep.txt', 'k', 1),
        entry('/k/edit.txt', 'e1', 1),
        entry('/k/del.png', 'd', 1),
      ]),
      snap([
        entry('/k/keep.txt', 'k', 1),
        entry('/k/edit.txt', 'e2', 1),
        entry('/n/add.mp3', 'a', 9),
      ]),
    );
    const kinds = events.map((e) => `${e.kind}:${e.file.name}`).sort();
    expect(kinds).toEqual(['added:add.mp3', 'modified:edit.txt', 'removed:del.png']);
  });

  it('пустой modified у обоих снимков — не событие', () => {
    const events = diffSnapshots(
      snap([entry('/p/a.flac', null, 100)]),
      snap([entry('/p/a.flac', null, 100)]),
    );
    expect(events).toEqual([]);
  });
});
