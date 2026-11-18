// src/composables/useMediaQuery.ts

import { onMounted, onUnmounted, ref, type Ref } from 'vue';

/**
 * Реактивный `window.matchMedia(query).matches`.
 *
 * Инициализируется синхронно (в браузере), чтобы `watch` с `immediate: true`
 * увидел корректное значение на первом рендере. SSR не поддерживается
 * (проект — SPA/PWA, SSR нет).
 */
export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  let mql: MediaQueryList | null = null;

  function update(e: MediaQueryListEvent | MediaQueryList): void {
    matches.value = e.matches;
  }

  onMounted(() => {
    mql = window.matchMedia(query);
    matches.value = mql.matches;
    mql.addEventListener('change', update);
  });

  onUnmounted(() => {
    mql?.removeEventListener('change', update);
    mql = null;
  });

  return matches;
}
