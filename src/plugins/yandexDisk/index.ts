// src/plugins/yandexDisk/index.ts
import { createYandexPlugin } from './createPlugin'
import { yandexDiskService } from './YandexDiskService'

const yandexPlugin = createYandexPlugin({
  id: 'yandex',
  name: 'Яндекс.Диск',
  icon: '☁️',
  service: yandexDiskService,
})

export default yandexPlugin
