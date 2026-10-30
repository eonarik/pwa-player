// server/src/plugins/feedback/routes.js

import { Router } from 'express';
import { ValidationError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import { sendFeedbackMail } from './mailer.js';

const RATE_LIMIT_MS = 60 * 1000; // 1 сообщение в минуту с IP

/** IP → timestamp последнего сообщения */
const lastSent = new Map();

function getClientIp(req) {
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

export const feedbackRoutes = Router();

feedbackRoutes.post('/', async (req, res, next) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';

  if (!message) {
    return next(new ValidationError('message is required'));
  }
  if (message.length > 5000) {
    return next(new ValidationError('message is too long (max 5000)'));
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return next(new ValidationError('invalid email'));
  }

  const ip = getClientIp(req);
  const now = Date.now();
  const last = lastSent.get(ip) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    const wait = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
    res.status(429).json({ error: `Слишком часто. Подождите ${wait} сек.` });
    return;
  }
  lastSent.set(ip, now);

  try {
    await sendFeedbackMail({
      message,
      email: email || undefined,
      yandexAuthenticated: Boolean(req.session?.yandexAccessToken),
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error('[feedback] send failed', err);
    next(err);
  }
});

// Экспорт для тестов
export function __clearRateLimit() {
  lastSent.clear();
}
