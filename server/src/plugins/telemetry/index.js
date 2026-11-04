// server/src/plugins/telemetry/index.js

import { Router } from 'express';
import express from 'express';
import { telemetryRoutes } from './routes.js';

export const router = Router();
// ВАЖНО: body для телеметрии — сырая строка JSONL, не JSON.
router.use(express.text({ type: ['text/plain', 'application/x-ndjson', 'application/json'], limit: '1mb' }));
router.use(telemetryRoutes);

export const prefix = '/api/telemetry';
