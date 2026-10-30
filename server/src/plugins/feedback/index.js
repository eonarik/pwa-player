// server/src/plugins/feedback/index.js

import { Router } from 'express';
import { feedbackRoutes } from './routes.js';

export const router = Router();
router.use(feedbackRoutes);

export const prefix = '/api/feedback';
