// src/services/backup/schema.spec.ts

import { describe, expect, it } from 'vitest';

import { BACKUP_FORMAT, BACKUP_VERSION, validateBackup, type CueiBackup } from './schema';

function makeBackup(): CueiBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {},
  };
}

describe('validateBackup', () => {
  it('принимает корректный бэкап и возвращает его же', () => {
    const backup = makeBackup();
    expect(validateBackup(backup)).toBe(backup);
  });

  it('бросает на не-объекте', () => {
    expect(() => validateBackup(null)).toThrow('Файл не является JSON-объектом');
    expect(() => validateBackup('{"format":"cuei-backup"}')).toThrow('Файл не является JSON-объектом');
    expect(() => validateBackup(42)).toThrow('Файл не является JSON-объектом');
  });

  it('бросает на чужом формате', () => {
    expect(() => validateBackup({ ...makeBackup(), format: 'other-backup' as typeof BACKUP_FORMAT })).toThrow(
      'Неверный формат бэкапа',
    );
  });

  it('бросает, если версия не число', () => {
    const raw = { ...makeBackup(), version: '2' };
    expect(() => validateBackup(raw)).toThrow('Неверная версия бэкапа');
  });

  it('бросает без секции data', () => {
    const raw = { ...makeBackup(), data: undefined };
    expect(() => validateBackup(raw)).toThrow('Отсутствует секция data');
  });

  it('пропускает бэкап более старой масти, но с корректными полями', () => {
    const raw = { ...makeBackup(), version: 1 };
    expect(validateBackup(raw).version).toBe(1);
  });
});
