// src/directives/tooltip.ts

import { createApp, h, reactive, type Directive } from 'vue';

interface TooltipState {
  text: string;
  visible: boolean;
  top: number;
  left: number;
  activeEl: HTMLElement | null;
}

const state = reactive<TooltipState>({
  text: '',
  visible: false,
  top: 0,
  left: 0,
  activeEl: null,
});

/**
 * Служебные данные директивы на элемент.
 *
 * WeakMap вместо `(el as any)._tooltipText`: состояние не попадает в тип
 * HTMLElement, не мешает инспектору и не требует обхода строгой типизации.
 * Запись живёт ровно пока жив элемент — сборщик мусора ничего не держит.
 */
interface TooltipEntry {
  text: string | null | undefined;
  show: () => void;
  hide: () => void;
  position: () => void;
}

const entries = new WeakMap<HTMLElement, TooltipEntry>();

let tooltipAppMounted = false;

export function initTooltip(): void {
  if (tooltipAppMounted) return;
  tooltipAppMounted = true;

  const host = document.createElement('div');
  document.body.appendChild(host);

  createApp({
    render() {
      if (!state.visible) return null;
      return h(
        'div',
        {
          class: 'cuei-tooltip',
          style: {
            top: `${state.top}px`,
            left: `${state.left}px`,
          },
        },
        state.text,
      );
    },
  }).mount(host);
}

/** Ставит тултип над элементом, при нехватке места — под него. */
function placeTooltip(el: HTMLElement): void {
  requestAnimationFrame(() => {
    // Позиционируем именно свой элемент: за время rAF активным мог стать другой.
    if (state.activeEl !== el) return;

    const rect = el.getBoundingClientRect();
    const tipEl = document.querySelector<HTMLElement>('.cuei-tooltip');
    if (!tipEl) return;

    const tipRect = tipEl.getBoundingClientRect();
    const margin = 8;

    let top = rect.top - tipRect.height - margin;
    let left = rect.left + rect.width / 2 - tipRect.width / 2;

    if (top < margin) top = rect.bottom + margin;
    if (left < margin) left = margin;
    if (left + tipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - tipRect.width - margin;
    }

    state.top = top;
    state.left = left;
  });
}

export const tooltip: Directive<HTMLElement, string | null | undefined> = {
  mounted(el, binding) {
    // Отключаем тултипы на тач-устройствах
    if (window.matchMedia('(hover: none)').matches) {
      return;
    }

    const entry: TooltipEntry = {
      text: binding.value,
      show: () => {
        if (!entry.text) return;

        state.activeEl = el;
        state.text = entry.text;
        state.visible = true;
        entry.position();
      },
      hide: () => {
        if (state.activeEl === el) {
          state.visible = false;
          state.activeEl = null;
        }
      },
      position: () => placeTooltip(el),
    };

    entries.set(el, entry);

    el.addEventListener('mouseenter', entry.show);
    el.addEventListener('mouseleave', entry.hide);
    el.addEventListener('focusin', entry.show);
    el.addEventListener('focusout', entry.hide);
  },

  updated(el, binding) {
    const entry = entries.get(el);
    if (!entry) return;
    entry.text = binding.value;

    // Обновляем тултип, только если он принадлежит ЭТОМУ элементу
    if (state.visible && state.activeEl === el) {
      state.text = binding.value ?? '';
      if (binding.value) {
        entry.position();
      } else {
        state.visible = false;
        state.activeEl = null;
      }
    }
  },

  unmounted(el) {
    const entry = entries.get(el);
    if (entry) {
      el.removeEventListener('mouseenter', entry.show);
      el.removeEventListener('mouseleave', entry.hide);
      el.removeEventListener('focusin', entry.show);
      el.removeEventListener('focusout', entry.hide);
      entries.delete(el);
    }

    if (state.activeEl === el) {
      state.visible = false;
      state.activeEl = null;
    }
  },
};
