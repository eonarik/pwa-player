// src/components/library/metadata/useFloatingDropdown.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { withSetup } from '@/test/withSetup';
import { useFloatingDropdown } from './useFloatingDropdown';

function setup() {
  const { result, unmount } = withSetup(() => useFloatingDropdown());
  return { ...result, unmount };
}

describe('useFloatingDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggle переключает isOpen и добавляет слушатели', () => {
    const { isOpen, toggle, unmount } = setup();
    expect(isOpen.value).toBe(false);
    toggle();
    expect(isOpen.value).toBe(true);
    toggle();
    expect(isOpen.value).toBe(false);
    unmount();
  });

  it('close закрывает независимо от toggle, idempotent', () => {
    const { isOpen, toggle, close, unmount } = setup();
    toggle();
    expect(isOpen.value).toBe(true);
    close();
    expect(isOpen.value).toBe(false);
    close();
    expect(isOpen.value).toBe(false);
    unmount();
  });

  it('клик вне триггера и панели закрывает', async () => {
    const { isOpen, toggle, unmount } = setup();
    toggle();
    expect(isOpen.value).toBe(true);

    const outside = document.createElement('div');
    document.body.appendChild(outside);

    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await nextTick();

    expect(isOpen.value).toBe(false);
    document.body.removeChild(outside);
    unmount();
  });
});
