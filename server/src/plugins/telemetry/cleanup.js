// server/src/plugins/telemetry/cleanup.js

import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../../shared/logger.js';

const TELEMETRY_DIR = process.env.TELEMETRY_DIR || './.telemetry';
const MAX_AGE_DAYS = Number(process.env.TELEMETRY_MAX_AGE_DAYS) || 30;

/**
 * Удаляет файлы телеметрии старше MAX_AGE_DAYS.
 * Игнорирует ошибки (не критично).
 */
export async function cleanupTelemetry() {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  try {
    const entries = await fs.readdir(TELEMETRY_DIR, { withFileTypes: true });
    let removed = 0;

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.jsonl')) continue;

      const full = path.join(TELEMETRY_DIR, entry.name);
      try {
        const stat = await fs.stat(full);
        if (stat.mtimeMs < cutoff) {
          await fs.unlink(full);
          removed++;
        }
      } catch {
        // ignore single file errors
      }
    }

    if (removed > 0) {
      logger.info(`[telemetry] cleanup: removed ${removed} old file(s)`);
    }
  } catch (err) {
    // Папки может не быть — это ок.
    if (err.code !== 'ENOENT') {
      logger.warn('[telemetry] cleanup failed', err);
    }
  }
}
