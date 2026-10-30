// src/services/markdown/index.ts

import type { MarkdownRenderer } from './types';
import { simpleRenderer } from './simpleRenderer';

export type { MarkdownRenderer } from './types';

let currentRenderer: MarkdownRenderer = simpleRenderer;

/**
 * Заменить рендерер (например, на marked + DOMPurify).
 * Вызывать один раз в main.ts (или в тестах).
 */
export function setMarkdownRenderer(renderer: MarkdownRenderer): void {
  currentRenderer = renderer;
}

export function getMarkdownRenderer(): MarkdownRenderer {
  return currentRenderer;
}
