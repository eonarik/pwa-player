// server/src/shared/logger.js

function ts() {
  return new Date().toISOString();
}

export const logger = {
  info(...args) {
    console.log(`[${ts()}] [info]`, ...args);
  },
  warn(...args) {
    console.warn(`[${ts()}] [warn]`, ...args);
  },
  error(...args) {
    console.error(`[${ts()}] [error]`, ...args);
  },
};
