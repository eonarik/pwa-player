// src/services/telemetry/autoFlush.ts

import { telemetry } from './TelemetryService';

/**
 * Слушает события жизни вкладки и делает flush, чтобы при закрытии/скрытии
 * страницы последние записи не потерялись.
 *
 * Возвращает функцию для отписки.
 */
export function startAutoFlush(): () => void {
  const onVisibility = () => {
    telemetry.event('visibility.change', { state: document.visibilityState });
    if (document.visibilityState === 'hidden') {
      telemetry.flush();
    }
  };

  const onFocus = () => telemetry.event('focus', {});
  const onBlur = () => telemetry.event('blur', {});

  const onPageHide = () => {
    telemetry.recordSessionEnd('pagehide', getMemMB());
  };

  const onBeforeUnload = () => {
    telemetry.flush();
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('beforeunload', onBeforeUnload);

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
}

function getMemMB(): number | null {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number };
  };
  if (!perf.memory) return null;
  return Math.round(perf.memory.usedJSHeapSize / 1024 / 1024);
}
