// server/src/config/routes.ts

import { Router } from 'express'
import { loadSettings } from '../settings/client.js'

export const configRouter = Router()

configRouter.get('/config', async (_req, res) => {
  const settings = await loadSettings()

  if (!settings) {
    res.json({
      hasSettings: false,
      publicFolders: [],
    })
    return
  }

  res.json({
    hasSettings: true,
    publicFolders: settings.publicFolders,
  })
})
