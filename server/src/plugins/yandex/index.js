// server/src/plugins/yandex/index.js

import { Router } from 'express'
import { yandexRoutes } from './routes.js'

export const router = Router()
router.use(yandexRoutes)

export const prefix = '/api/disk'
