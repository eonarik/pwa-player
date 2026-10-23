// server/src/modules.js

import * as core from './core/index.js'
import { metadataRouter } from './metadata/routes.js'
import * as yandex from './plugins/yandex/index.js'
import * as feedback from './plugins/feedback/index.js'
import * as yaSelf from './plugins/yandex-self/index.js'
import * as podcasts from './plugins/podcasts/index.js'
import * as hlsProxy from './plugins/hls-proxy/index.js'

const MODULES = [
  { prefix: core.prefix, router: core.router }, // /api/auth
  { prefix: '/api', router: metadataRouter }, // /api/track-metadata
  { prefix: yandex.prefix, router: yandex.router }, // /api/disk
  { prefix: feedback.prefix, router: feedback.router }, // /api/feedback
  { prefix: yaSelf.prefix, router: yaSelf.router }, // /api/yandex-self
  { prefix: podcasts.prefix, router: podcasts.router },
  { prefix: hlsProxy.prefix, router: hlsProxy.router },
]

export function mountModules(app) {
  for (const mod of MODULES) {
    app.use(mod.prefix, mod.router)
  }
}
