// src/utils/mergeText.spec.ts

import { describe, it, expect } from 'vitest';
import { mergeText } from './mergeText';

describe('mergeText', () => {
  it('возвращает theirs, если база и ours совпадают', () => {
    const res = mergeText('base', 'base', 'theirs');
    expect(res.text).toBe('theirs');
    expect(res.hasConflicts).toBe(false);
  });

  it('возвращает ours, если база и theirs совпадают', () => {
    const res = mergeText('base', 'ours', 'base');
    expect(res.text).toBe('ours');
    expect(res.hasConflicts).toBe(false);
  });

  it('объединяет изменения в разных строках без конфликта', () => {
    const base = 'line1\nline2\nline3';
    const ours = 'line1-edited\nline2\nline3';
    const theirs = 'line1\nline2\nline3-edited';

    const res = mergeText(base, ours, theirs);
    expect(res.hasConflicts).toBe(false);
    expect(res.text).toBe('line1-edited\nline2\nline3-edited');
  });

  it('создает конфликт, если изменена одна и та же строка', () => {
    const base = 'line1\nline2';
    const ours = 'line1-ours\nline2';
    const theirs = 'line1-theirs\nline2';

    const res = mergeText(base, ours, theirs);
    expect(res.hasConflicts).toBe(true);
    expect(res.text).toContain('<<<<<<<');
    expect(res.text).toContain('=======');
    expect(res.text).toContain('>>>>>>>');
  });
});
