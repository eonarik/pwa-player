// src/utils/pluginDiagnostics.spec.ts

import { beforeEach, describe, expect, it } from 'vitest';

import { clearDiagnostics, diagError, diagInfo, getDiagnostics } from './pluginDiagnostics';

describe('pluginDiagnostics', () => {
  beforeEach(() => {
    clearDiagnostics();
  });

  it('складывает info-события в порядке добавления', () => {
    diagInfo('a');
    diagInfo('b');

    const events = getDiagnostics();
    expect(events).toHaveLength(2);
    expect(events[0]?.text).toBe('a');
    expect(events[1]?.kind).toBe('info');
  });

  it('сериализует Error вместе с cause-цепочкой', () => {
    const err = new Error('chunk load failed', { cause: new Error('403') });
    diagError('entry() radio', err);

    const [event] = getDiagnostics();
    expect(event?.kind).toBe('error');
    expect(event?.text).toContain('entry() radio');
    expect(event?.text).toContain('chunk load failed');
    expect(event?.text).toContain('cause=403');
  });

  it('не бросает на не-Error значении', () => {
    diagError('scope', 'plain string');

    const [event] = getDiagnostics();
    expect(event?.text).toContain('plain string');
  });

  it('обрезает буфер при переполнении', () => {
    for (let i = 0; i < 150; i++) diagInfo(`e${i}`);

    expect(getDiagnostics().length).toBeLessThanOrEqual(100);
  });
});
