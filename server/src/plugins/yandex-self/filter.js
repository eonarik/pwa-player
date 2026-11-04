// server/src/plugins/yandex-self/filter.js

import { isAudioFile } from '../../shared/audio.js';

export { isAudioFile };

/**
 * Скрытый файл — если имя начинается с точки И в нём есть еще одна точка.
 * Пример:
 * - `.settings.json` → скрытый
 * - `.txt` → не скрытый (нет имени)
 * - `.gitignore` → не скрытый (нет расширения)
 * - `song.mp3` → не скрытый
 */
function isHiddenFile(name) {
  return name.startsWith('.') && name.indexOf('.', 1) !== -1;
}

function normalizePathString(p) {
  if (!p) return '';
  return p
    .trim()
    .replace(/^disk:/i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\/+/g, '/');
}

function removePrefix(path, cleanRoot) {
  const normPath = normalizePathString(path);
  const normRoot = normalizePathString(cleanRoot);

  if (normRoot && normPath.startsWith(normRoot)) {
    return normPath.slice(normRoot.length).replace(/^\/+/, '');
  }
  return normPath;
}

export function mapAndFilterItems(items, path, allowedFolders, cleanRoot) {
  let result = (items || [])
    .filter((item) => {
      // Скрываем скрытые файлы (но не папки)
      if (item.type === 'file' && isHiddenFile(item.name)) {
        return false;
      }
      return true;
    })
    .map((item) => {
      const relativePath = removePrefix(item.path, cleanRoot);

      return {
        ...item,
        path: relativePath,
        isAudio: item.type === 'file' && isAudioFile(item.name),
      };
    });

  if (Array.isArray(allowedFolders) && allowedFolders.length > 0) {
    result = result.filter((item) => {
      const currentPath = path === '/' ? '' : path.replace(/^\/+/, '');
      const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;

      return allowedFolders.some((f) => {
        const cleanF = normalizePathString(f);
        return cleanF === itemPath || cleanF.startsWith(itemPath + '/') || itemPath.startsWith(cleanF + '/');
      });
    });
  }

  return result;
}

export function stripCleanRoot(path, cleanRoot) {
  if (!path) return '/';
  const relative = removePrefix(path, cleanRoot);
  return '/' + relative;
}

export function normalizePath(path, root) {
  let p = path.replace(/^disk:/i, '');
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);

  let cleanRoot = root.replace(/\/+$/, '');
  if (cleanRoot && !cleanRoot.startsWith('/')) cleanRoot = '/' + cleanRoot;

  const normRoot = normalizePathString(cleanRoot);
  const normP = normalizePathString(p);

  if (normRoot && normP.startsWith(normRoot)) {
    p = normP.slice(normRoot.length);
    if (!p.startsWith('/')) p = '/' + p;
  }

  if (p === '') p = '/';

  return { path: p, cleanRoot };
}
