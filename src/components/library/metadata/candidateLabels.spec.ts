// src/components/library/metadata/candidateLabels.spec.ts

import { describe, expect, it } from 'vitest';
import type { MetadataCandidate } from '@/types/metadata';
import {
  candidateAlbumLabel,
  candidateSourceLabel,
  selectedCandidateLabel,
  NO_CANDIDATE_LABEL,
} from './candidateLabels';

function c(overrides: Partial<MetadataCandidate> = {}): MetadataCandidate {
  return {
    id: 'c1' as never,
    artist: 'Artist',
    title: 'Title',
    album: '',
    coverUrl: null,
    similarity: 0.9,
    provider: 'iTunes',
    ...overrides,
  };
}

describe('candidateLabels', () => {
  it('нет индекса — дефолтная метка', () => {
    expect(selectedCandidateLabel([], null)).toBe(NO_CANDIDATE_LABEL);
  });

  it('индекс валидный — «артист — трек»', () => {
    const cs = [c({ artist: 'A', title: 'B' })];
    expect(selectedCandidateLabel(cs, 0)).toBe('A — B');
  });

  it('альбом: есть — «Альбом: X», нет — «Альбом: —»', () => {
    expect(candidateAlbumLabel(c({ album: 'My Album' }))).toBe('Альбом: My Album');
    expect(candidateAlbumLabel(c({ album: '' }))).toBe('Альбом: —');
    expect(candidateAlbumLabel(c({ album: '  ' }))).toBe('Альбом: —');
  });

  it('источник: нормализует провайдера и вычисляет процент', () => {
    expect(candidateSourceLabel(c({ similarity: 0.75 }))).toBe('Источник: iTunes — 75%');
    expect(candidateSourceLabel(c({ provider: '', similarity: 1 }))).toBe('Источник: unknown — 100%');
  });
});
