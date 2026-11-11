// src/directives/tooltip.spec.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref, withDirectives, type App } from 'vue';

import { initTooltip, tooltip } from './tooltip';

/**
 * jsdom не реализует matchMedia, а директива спрашивает '(hover: none)'.
 * hoverCapable=false эмулирует тач-устройство.
 */
function stubMatchMedia(hoverCapable: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: !hoverCapable,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function mountTarget(initialText: string | null) {
  const text = ref<string | null>(initialText);
  const host = document.createElement('div');
  document.body.appendChild(host);

  const app: App = createApp(
    defineComponent({
      setup: () => () => withDirectives(h('div', { 'data-testid': 'tip-target' }), [[tooltip, text.value]]),
    }),
  );
  app.mount(host);

  const el = host.querySelector<HTMLElement>('[data-testid="tip-target"]');
  if (!el) throw new Error('целевой элемент не отрендерен');

  return {
    text,
    el,
    unmount: () => {
      app.unmount();
      host.remove();
    },
  };
}

const tip = (): HTMLElement | null => document.querySelector<HTMLElement>('.cuei-tooltip');

describe('директива tooltip', () => {
  beforeEach(() => {
    stubMatchMedia(true);
    // Позиционирование не важно для проверок, но rAF не должен быть асинхронным.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      cb(0);
      return 1;
    });
    initTooltip();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('показывает тултип на hover и скрывает на уходе курсора', async () => {
    const { el, unmount } = mountTarget('Привет');

    el.dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    expect(tip()?.textContent).toBe('Привет');

    el.dispatchEvent(new MouseEvent('mouseleave'));
    await nextTick();
    expect(tip()).toBeNull();

    unmount();
  });

  it('обновляет текст активного тултипа и скрывается на пустом значении', async () => {
    const { el, text, unmount } = mountTarget('Первый');

    el.dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    expect(tip()?.textContent).toBe('Первый');

    text.value = 'Второй';
    await nextTick();
    expect(tip()?.textContent).toBe('Второй');

    text.value = null;
    await nextTick();
    expect(tip()).toBeNull();

    unmount();
  });

  it('не показывает тултип после unmount элемента', async () => {
    const { el, unmount } = mountTarget('Навсегда');

    unmount();

    el.dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    expect(tip()).toBeNull();
  });

  it('не навешивает слушатели на тач-устройствах', async () => {
    stubMatchMedia(false);
    const { el, unmount } = mountTarget('Не для тача');

    el.dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    expect(tip()).toBeNull();

    unmount();
  });
});
