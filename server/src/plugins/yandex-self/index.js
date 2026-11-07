// server/src/plugins/yandex-self/index.js

import { Router } from 'express';
import { authRoutes } from './routes/auth.js';
import { resourcesRoutes } from './routes/resources.js';
import { downloadRoutes } from './routes/download.js';
import { textRoutes } from './routes/text.js';
import { writeRoutes } from './routes/write.js';

export const router = Router();

router.use(authRoutes); // POST /auth, POST /logout, GET /auth/check (без requireAuth)
router.use(resourcesRoutes); // GET /resources (requireAuth внутри)
router.use(downloadRoutes); // GET /download (requireAuth внутри)
router.use(textRoutes); // GET /text, PUT /text (requireAuth внутри)
router.use(writeRoutes); // POST /folder, DELETE /resource, POST /move, PUT /upload

export const prefix = '/api/yandex-self';
