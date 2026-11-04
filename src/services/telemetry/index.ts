// src/services/telemetry/index.ts

import { installPatches } from './patches';
import { startSampler } from './sampler';
import { startAutoFlush } from './autoFlush';
import { telemetry } from './TelemetryService';

let teardown: (() => void) | null = null;

/**
 * Инициализирует телеметрию: патчи, sampler, auto-flush, ловушки ошибок.
 *
 * Вызывается один раз в main.ts при VITE_TELEMETRY === 'true'.
 * В прод-сборке не вызывается (если явно не выставить переменную).
 */
export function initTelemetry(): void {
  if (teardown) return;

  installPatches();
  telemetry.start();

  const stopSampler = startSampler();
  const stopAutoFlush = startAutoFlush();

  const onWindowError = (event: ErrorEvent) => {
    telemetry.record('error', {
      kind: 'window.error',
      msg: (event.message || '').slice(0, 200),
      stack: event.error?.stack?.slice(0, 1000),
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message.slice(0, 200) : String(reason).slice(0, 200);
    const stack = reason instanceof Error ? reason.stack?.slice(0, 1000) : undefined;

    telemetry.record('error', {
      kind: 'unhandledrejection',
      msg,
      stack,
    });
  };

  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  teardown = () => {
    stopSampler();
    stopAutoFlush();
    window.removeEventListener('error', onWindowError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    telemetry.stop();
    teardown = null;
  };
}

export { telemetry } from './TelemetryService';
