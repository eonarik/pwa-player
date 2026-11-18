// server/src/plugins/radio/routes.js

import { Router } from 'express';
import { logger } from '../../shared/logger.js';

export const radioRoutes = Router();

const API_BASE = 'https://de1.api.radio-browser.info';

/**
 * Универсальный прокси для Radio Browser.
 * Перехватывает GET-запросы, перенаправляет на API_BASE,
 * прокидывает статус-код и JSON-ответ.
 */
radioRoutes.use(async (req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }

  // req.originalUrl выглядит как /api/radio-browser/json/stations/search?name=...
  // Отрезаем префикс /api/radio-browser, чтобы получить /json/...
  const path = req.originalUrl.replace(/^\/api\/radio-browser/, '');
  const url = `${API_BASE}${path}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CUEI/1.0 (Radio Proxy)',
      },
    });

    if (!response.ok) {
      logger.warn(`[radio-proxy] Upstream error ${response.status} for ${url}`);
      res.status(response.status).json({ error: `Upstream error: ${response.status}` });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    logger.error('[radio-proxy] request failed', err);
    res.status(502).json({ error: 'Bad gateway' });
  }
});
