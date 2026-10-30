// src/stores/library/writer/helpers.ts

/**
 * Совпадает ли source с sourceId (учитывая под-источники: 'local' → 'local:Music').
 */
export function matchesSource(source: string | undefined, sourceId: string): boolean {
  if (!source) return false;
  return source === sourceId || source.startsWith(sourceId + ':');
}
