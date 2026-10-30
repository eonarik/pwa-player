// server/src/plugins/hls-proxy/index.js

import { Router } from 'express';
import { hlsProxyRoutes } from './routes.js';

export const router = Router();
router.use(hlsProxyRoutes);

export const prefix = '/api';
