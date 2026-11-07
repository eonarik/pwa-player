// server/src/plugins/yandex-self/routes/text.js

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveRequestPath } from '../middleware/access.js';
import { yandexResourceMeta, yandexDownloadText, yandexUploadText } from '../../../shared/yandexApi.js';

export const textRoutes = Router();

textRoutes.get('/text', requireAuth, async (req, res) => {
  const ctx = resolveRequestPath(req, res, req.query.path);
  if (!ctx) return;

  try {
    const meta = await yandexResourceMeta(process.env.YANDEX_SELF_TOKEN, ctx.fullPath);
    const content = await yandexDownloadText(process.env.YANDEX_SELF_TOKEN, ctx.fullPath);

    res.json({
      content: content ?? '',
      modified: meta.modified ?? null,
      size: meta.size ?? null,
    });
  } catch (err) {
    if (err.status === 404 || (err.name === 'YandexApiError' && err.message?.includes('not found'))) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

textRoutes.put('/text', requireAuth, async (req, res) => {
  const ctx = resolveRequestPath(req, res, req.query.path);
  if (!ctx) return;

  const content = typeof req.body?.content === 'string' ? req.body.content : null;
  if (content === null) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  try {
    await yandexUploadText(process.env.YANDEX_SELF_TOKEN, ctx.fullPath, content);
    const meta = await yandexResourceMeta(process.env.YANDEX_SELF_TOKEN, ctx.fullPath);
    res.json({ ok: true, modified: meta.modified ?? null });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
