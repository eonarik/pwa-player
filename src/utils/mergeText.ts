// src/utils/mergeText.ts

import { mergeDiff3 } from 'node-diff3';

export interface MergeResult {
  /** Итоговый текст (объединенный или с маркерами конфликта) */
  text: string;
  /** true, если были конфликты и нужно ручное разрешение */
  hasConflicts: boolean;
}

/**
 * Трехстороннее слияние текста (аналог git merge).
 *
 * @param base Текст, который был при открытии файла
 * @param ours Наши локальные правки
 * @param theirs Версия, которая пришла с сервера (Диска)
 */
export function mergeText(base: string, ours: string, theirs: string): MergeResult {
  // Если кто-то ничего не менял — отдаем другую версию
  if (base === ours) return { text: theirs, hasConflicts: false };
  if (base === theirs) return { text: ours, hasConflicts: false };

  // Если обе версии одинаковы (одинаково отредактировали) — конфликта нет
  if (ours === theirs) return { text: ours, hasConflicts: false };

  // Разбиваем на строки для алгоритма
  const baseLines = base.split('\n');
  const ourLines = ours.split('\n');
  const theirLines = theirs.split('\n');

  // node-diff3 возвращает { result: string[], conflict: boolean }
  const mergeResult = mergeDiff3(ourLines, baseLines, theirLines, {
    stringSeparator: '\n',
  });

  return {
    text: mergeResult.result.join('\n'),
    hasConflicts: mergeResult.conflict,
  };
}
