// src/services/markdown/types.ts

/**
 * Интерфейс рендерера Markdown.
 * Реализация отвечает за санитайзинг: render() должен возвращать
 * только безопасный HTML
 */
export interface MarkdownRenderer {
  /**
   * Рендерит Markdown в безопасный HTML.
   * Если рендер невозможен — возвращает null (компонент покажет fallback).
   */
  render(source: string): string | null
}
