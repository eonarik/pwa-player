// server/src/plugins/telemetry/routes.js

import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../../shared/logger.js';

const TELEMETRY_DIR = process.env.TELEMETRY_DIR || './.telemetry';
const MAX_FILE_BYTES = (Number(process.env.TELEMETRY_MAX_FILE_MB) || 50) * 1024 * 1024;
const RATE_LIMIT_PER_MIN = 60;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const rateLimitMap = new Map();

function getClientIp(req) {
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_MIN) return false;
  entry.count++;
  return true;
}

function todayUtc() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const telemetryRoutes = Router();

telemetryRoutes.post('/', async (req, res) => {
  // sendBeacon не может отправлять кастомные заголовки, поэтому sid приходит в query.
  // Поддерживаем и заголовок (на случай fetch-отправки).
  const sid = req.query.sid || req.headers['x-session-id'];

  if (typeof sid !== 'string' || !UUID_V4.test(sid)) {
    res.status(400).json({ error: 'invalid or missing sid' });
    return;
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: 'too many requests' });
    return;
  }

  const body = typeof req.body === 'string' ? req.body : '';
  if (!body || body.length === 0) {
    res.status(400).json({ error: 'empty body' });
    return;
  }
  if (body.length > 1_000_000) {
    res.status(413).json({ error: 'body too large (max 1MB)' });
    return;
  }

  const file = path.join(TELEMETRY_DIR, `${todayUtc()}_${sid}.jsonl`);

  try {
    await fs.mkdir(TELEMETRY_DIR, { recursive: true });

    try {
      const stat = await fs.stat(file);
      if (stat.size > MAX_FILE_BYTES) {
        res.status(413).json({ error: 'session file too large' });
        return;
      }
    } catch {
      // файла нет — ок
    }

    await fs.appendFile(file, body.endsWith('\n') ? body : body + '\n');

    const lines = body.split('\n').filter(Boolean).length;
    res.json({ ok: true, sessionId: sid, bytes: body.length, lines });
  } catch (err) {
    logger.error('[telemetry] write failed', err);
    res.status(500).json({ error: 'write failed' });
  }
});
