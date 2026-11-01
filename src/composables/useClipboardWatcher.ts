// src/composables/useClipboardWatcher.ts

import { onMounted, onUnmounted } from 'vue';
import { toastService } from '@/services/ui/ToastService';

const SESSION_KEY = 'cuei:lastClipboardHash';
const TOAST_DURATION_MS = 8000;

export function useClipboardWatcher() {
  let isChecking = false;

  function hasSeen(text: string): boolean {
    const hash = simpleHash(text.trim());
    return sessionStorage.getItem(SESSION_KEY) === hash;
  }

  function markAsSeen(text: string): void {
    const hash = simpleHash(text.trim());
    sessionStorage.setItem(SESSION_KEY, hash);
  }

  async function checkClipboard() {
    if (isChecking) return;
    isChecking = true;

    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
        return;
      }

      // В Playwright без фокуса readText может кинуть ошибку
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim().startsWith('CUEI1:')) {
        return;
      }

      if (hasSeen(text)) {
        return;
      }

      markAsSeen(text);

      toastService.info(
        'В буфере найден плейлист. Откройте «Плейлисты» → «Импортировать», чтобы добавить его.',
        TOAST_DURATION_MS,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        return;
      }
      console.debug('[clipboard-watcher] read ignored', err);
    } finally {
      isChecking = false;
    }
  }

  const onWindowFocus = () => {
    void checkClipboard();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void checkClipboard();
    }
  };

  onMounted(() => {
    // Убрали setTimeout
    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
  });

  onUnmounted(() => {
    window.removeEventListener('focus', onWindowFocus);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });
}

function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}
