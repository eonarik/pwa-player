// src/services/telemetry/instrument.ts

import { telemetry } from './TelemetryService';

/**
 * Оборачивает асинхронную функцию, замеряя её длительность.
 * Шлёт два события: `${name}.start` и `${name}.done` (или `.error`).
 * Если упало — шлёт `${name}.error` с сообщением.
 *
 * Если телеметрия отключена — просто вызывает fn без накладных расходов.
 */
export async function withTelemetry<T>(name: string, data: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const startTs = performance.now();
  telemetry.event(`${name}.start`, data);

  try {
    const result = await fn();
    telemetry.event(`${name}.done`, {
      ...data,
      ms: Math.round(performance.now() - startTs),
    });
    return result;
  } catch (err) {
    telemetry.event(`${name}.error`, {
      ...data,
      ms: Math.round(performance.now() - startTs),
      msg: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
    });
    throw err;
  }
}
