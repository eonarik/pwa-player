// src/plugins/__tests__/candidateFileName.unit.test.ts

import { describe, it, expect } from 'vitest';
import { candidateFileName } from '../searchStreams';
import type { SearchCandidate } from '../types';

function cand(partial: Partial<SearchCandidate>): SearchCandidate {
  return {
    pluginId: 'zvuk',
    trackId: 't1',
    artist: 'Artist',
    title: 'Title',
    ...partial,
  };
}

describe('candidateFileName (CUEI-0005)', () => {
  it('базовое имя "{artist} - {title}.mp3"', () => {
    expect(candidateFileName(cand({}), new Set())).toBe('Artist - Title.mp3');
  });

  it('санитизирует недопустимые символы', () => {
    const name = candidateFileName(cand({ artist: 'A/B:C', title: 'D*E?"F' }), new Set());
    expect(name).toBe('ABC - DEF.mp3');
  });

  it('фолбэки для пустых artist/title', () => {
    expect(candidateFileName(cand({ artist: '   ', title: '' }), new Set())).toBe('Unknown - Track.mp3');
  });

  it('дедуп: суффикс -2, -3 при занятом имени', () => {
    const taken = new Set(['Artist - Title.mp3', 'Artist - Title-2.mp3']);
    expect(candidateFileName(cand({}), taken)).toBe('Artist - Title-3.mp3');
  });
});
