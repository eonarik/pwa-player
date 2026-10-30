// server/src/plugins/yandex-self/auth.js

import { getSelfConfig } from './config.js';

export async function login(ctx, password) {
  const config = await getSelfConfig();
  let targetConfig = null;

  if (ctx && config.contexts[ctx]) {
    targetConfig = config.contexts[ctx];
  } else if (config.common) {
    targetConfig = config.common;
  }

  if (!targetConfig) throw new Error('Контекст не найден и общий доступ не настроен');
  if (targetConfig.password && password !== targetConfig.password) throw new Error('Неверный пароль');

  const allowedFolders = targetConfig.folders === undefined ? null : targetConfig.folders;
  const userId = ctx || 'common';

  // Возвращаем данные для сессии (без токенов)
  return { userId, allowedFolders };
}
