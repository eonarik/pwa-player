// server/src/plugins/podcasts/index.js

import { Router } from 'express';
import { podcastsRoutes } from './routes.js';
export const router = Router();
router.use(podcastsRoutes);
export const prefix = '/api/podcasts';
