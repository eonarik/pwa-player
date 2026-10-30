// server/src/shared/audio.js

/**
 * Расширения аудиофайлов, которые плеер умеет воспроизводить.
` — синхронизировать вручную.
 */
export const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.wma']);

/**
 * Определяет, является ли имя файла аудио.
 * Сравнение по расширению, регистронезависимо.
 */
export function isAudioFile(name) {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return false;
  return AUDIO_EXTENSIONS.has(name.slice(dot).toLowerCase());
}
