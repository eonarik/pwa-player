const isTest = import.meta.env.MODE === 'test';
const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev && !isTest) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev && !isTest) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    // В тестах не засоряем вывод, но в продакшене можем оставить
    if (!isTest) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    // Ошибки выводим всегда (и в тестах тоже, если это не Vitest-специфичные моки)
    console.error(...args);
  },
};
