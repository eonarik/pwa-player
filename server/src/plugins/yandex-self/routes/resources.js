// server/src/plugins/yandex-self/routes/resources.js

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { yandexListResources } from '../../../shared/yandexApi.js';
import { mapAndFilterItems, normalizePath } from '../filter.js';

export const resourcesRoutes = Router();

resourcesRoutes.get('/resources', requireAuth, async (req, res) => {
  const root = process.env.YANDEX_SELF_PATH || '/';
  const rawPath = typeof req.query.path === 'string' ? req.query.path : '/';
  const { path, cleanRoot } = normalizePath(rawPath, root);

  const allowedFolders = req.selfAuth.allowedFolders;

  // Для корня `/` — всегда разрешено, но если allowedFolders = [],
  // отдадим 403 (как раньше).
  if (Array.isArray(allowedFolders) && allowedFolders.length === 0) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }

  if (Array.isArray(allowedFolders) && allowedFolders.length > 0 && path !== '/') {
    const isAllowed = allowedFolders.some((f) => {
      const cleanF = f.replace(/\/+$/, '');
      return cleanF === path || cleanF.startsWith(path + '/') || path.startsWith(cleanF + '/');
    });
    if (!isAllowed) {
      res.status(403).json({ error: 'Доступ к этой папке запрещён' });
      return;
    }
  }

  try {
    const diskPath = path === '/' ? `disk:${cleanRoot}` : `disk:${cleanRoot}${path}`;
    const data = await yandexListResources(process.env.YANDEX_SELF_TOKEN, diskPath);

    const items = mapAndFilterItems(data._embedded?.items || [], path, allowedFolders, cleanRoot);
    const clientRootPath = path === '' ? '/' : path;

    data._embedded = { ...data._embedded, items, path: clientRootPath };
    data.path = clientRootPath;
    data.total = items.length;
    data.items = items;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
