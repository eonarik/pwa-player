// server/src/modules.js

import * as core from './core/index.js';
import { metadataRouter } from './metadata/routes.js';
import * as yandex from './plugins/yandex/index.js';
import * as feedback from './plugins/feedback/index.js';
import * as yaSelf from './plugins/yandex-self/index.js';
import * as podcasts from './plugins/podcasts/index.js';
import * as hlsProxy from './plugins/hls-proxy/index.js';
import * as zvuk from './plugins/zvuk/index.js';

const MODULES = [
  { prefix: core.prefix, router: core.router },
  { prefix: '/api', router: metadataRouter },
  { prefix: yandex.prefix, router: yandex.router },
  { prefix: feedback.prefix, router: feedback.router },
  { prefix: yaSelf.prefix, router: yaSelf.router },
  { prefix: podcasts.prefix, router: podcasts.router },
  { prefix: hlsProxy.prefix, router: hlsProxy.router },
  { prefix: zvuk.prefix, router: zvuk.router },
];

export function mountModules(app) {
  for (const mod of MODULES) {
    app.use(mod.prefix, mod.router);
  }
}
