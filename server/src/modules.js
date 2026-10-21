// server/src/modules.js

import * as core from './core/index.js'
import { metadataRouter } from './metadata/routes.js'
import * as yandex from './plugins/yandex/index.js'
import * as feedback from './plugins/feedback/index.js'
import * as yaSelf from './plugins/yandex-self/index.js'

const MODULES = [
  { prefix: core.prefix, router: core.router }, // /api/auth
  { prefix: '/api', router: metadataRouter }, // /api/track-metadata
  { prefix: yandex.prefix, router: yandex.router }, // /api/disk
  { prefix: feedback.prefix, router: feedback.router }, // /api/feedback
  { prefix: yaSelf.prefix, router: yaSelf.router }, // /api/yandex-self
]

export function mountModules(app) {
  for (const mod of MODULES) {
    app.use(mod.prefix, mod.router)
  }
}
