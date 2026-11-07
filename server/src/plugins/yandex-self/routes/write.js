// server/src/plugins/yandex-self/routes/write.js

import express, { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveRequestPath, joinDiskPath, isPathAllowed } from '../middleware/access.js';
import { normalizePath } from '../filter.js';
import {
  yandexCreateFolder,
  yandexDeleteResource,
  yandexMoveResource,
  yandexGetUploadUrl,
} from '../../../shared/yandexApi.js';
import { logger } from '../../../shared/logger.js';

export const writeRoutes = Router();

// 30 МБ + запас на заголовки. express.raw парсит body в Buffer.
const uploadMiddleware = express.raw({ type: '*/*', limit: '35mb' });

/**
 * POST /folder
 * body: { path: parentPath, name }
 */
writeRoutes.post('/folder', requireAuth, async (req, res) => {
  const { path: parentPath = '/', name } = req.body || {};
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const root = process.env.YANDEX_SELF_PATH || '/';
  const { path, cleanRoot } = normalizePath(parentPath, root);

  if (!isPathAllowed(path, req.selfAuth.allowedFolders)) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }

  const fullPath = joinDiskPath(cleanRoot, path, name);

  try {
    await yandexCreateFolder(process.env.YANDEX_SELF_TOKEN, fullPath);
    res.json({ ok: true, path: fullPath });
  } catch (err) {
    if (err.status === 409) {
      res.status(409).json({ error: 'Папка уже существует' });
      return;
    }
    logger.warn(`[yandex-self] create folder failed: ${err.message?.slice(0, 200)}`);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * DELETE /resource?path=...
 * Яндекс удаляет папки рекурсивно сам.
 */
writeRoutes.delete('/resource', requireAuth, async (req, res) => {
  const ctx = resolveRequestPath(req, res, req.query.path);
  if (!ctx) return;

  try {
    await yandexDeleteResource(process.env.YANDEX_SELF_TOKEN, ctx.fullPath);
    res.json({ ok: true });
  } catch (err) {
    if (err.status === 404) {
      res.status(404).json({ error: 'Ресурс не найден' });
      return;
    }
    logger.warn(`[yandex-self] delete resource failed: ${err.message?.slice(0, 200)}`);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * POST /move
 * body: { fromPath, toPath }
 */
writeRoutes.post('/move', requireAuth, async (req, res) => {
  const { fromPath: rawFrom, toPath: rawTo } = req.body || {};
  if (!rawFrom || !rawTo) {
    res.status(400).json({ error: 'fromPath and toPath are required' });
    return;
  }

  const root = process.env.YANDEX_SELF_PATH || '/';
  const from = normalizePath(rawFrom, root);
  const to = normalizePath(rawTo, root);

  if (!isPathAllowed(from.path, req.selfAuth.allowedFolders) || !isPathAllowed(to.path, req.selfAuth.allowedFolders)) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }

  const fullFrom = from.path === '/' ? `disk:${from.cleanRoot}` : `disk:${from.cleanRoot}${from.path}`;
  const fullTo = to.path === '/' ? `disk:${to.cleanRoot}` : `disk:${to.cleanRoot}${to.path}`;

  try {
    await yandexMoveResource(process.env.YANDEX_SELF_TOKEN, fullFrom, fullTo);
    res.json({ ok: true, fromPath: fullFrom, toPath: fullTo });
  } catch (err) {
    if (err.status === 409) {
      res.status(409).json({ error: 'Ресурс с таким именем уже существует' });
      return;
    }
    if (err.status === 404) {
      res.status(404).json({ error: 'Ресурс не найден' });
      return;
    }
    logger.warn(`[yandex-self] move failed: ${err.message?.slice(0, 200)}`);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * PUT /upload?path=<parentPath>&name=<fileName>
 * body: raw (audio/*), ≤ 35 МБ.
 */
writeRoutes.put('/upload', requireAuth, uploadMiddleware, async (req, res) => {
  const { path: rawParent, name } = req.query;
  if (!rawParent || !name) {
    res.status(400).json({ error: 'path and name are required' });
    return;
  }

  const root = process.env.YANDEX_SELF_PATH || '/';
  const { path, cleanRoot } = normalizePath(rawParent, root);

  if (!isPathAllowed(path, req.selfAuth.allowedFolders)) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }

  if (!Buffer.isBuffer(req.body)) {
    logger.warn(`[yandex-self] upload: invalid body for "${name}" (content-type: ${req.headers['content-type']})`);
    res.status(400).json({ error: 'Invalid body' });
    return;
  }

  const fullPath = joinDiskPath(cleanRoot, path, name);

  try {
    const uploadMeta = await yandexGetUploadUrl(process.env.YANDEX_SELF_TOKEN, fullPath);

    const putResponse = await fetch(uploadMeta.href, {
      method: 'PUT',
      body: req.body,
      headers: {
        'Content-Type': req.headers['content-type'] || 'audio/mpeg',
      },
    });

    if (!putResponse.ok) {
      res.status(putResponse.status).json({ error: `Upload failed: ${putResponse.status}` });
      return;
    }

    res.json({ ok: true, path: fullPath });
  } catch (err) {
    logger.warn(`[yandex-self] upload failed: ${err.message?.slice(0, 200)}`);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});
