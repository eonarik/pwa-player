// src/plugins/yandexSelf/index.ts
import { createYandexPlugin } from '../yandexDisk/createPlugin'
import { yandexSelfService } from './YandexSelfService'

const yandexSelfPlugin = createYandexPlugin({
  id: 'yandex-self',
  name: 'Логии',
  icon: '📜',
  service: yandexSelfService,
  isSelf: true,
})

export default yandexSelfPlugin
