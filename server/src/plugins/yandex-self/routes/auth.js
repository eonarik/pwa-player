// server/src/plugins/yandex-self/routes/auth.js

import { Router } from 'express';
import { login } from '../auth.js';

export const authRoutes = Router();

authRoutes.post('/auth', async (req, res) => {
  const { ctx, password } = req.body;
  try {
    const result = await login(ctx, password);
    req.session.selfAuth = result;
    res.json({ ok: true, allowedFolders: result.allowedFolders });
  } catch (err) {
    if (err.code === 'YANDEX_API_ERROR' || err.name === 'YandexApiError') {
      res.status(err.status || 500).json({ error: err.message });
      return;
    }
    if (err.message === 'Неверный пароль' || err.message === 'Контекст не найден и общий доступ не настроен') {
      res.status(401).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

authRoutes.post('/logout', (req, res) => {
  if (req.session) {
    req.session.selfAuth = null;
  }
  res.json({ ok: true });
});

authRoutes.get('/auth/check', (req, res) => {
  if (!req.session?.selfAuth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json({ ok: true });
});
