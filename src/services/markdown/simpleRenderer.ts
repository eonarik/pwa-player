// src/services/markdown/simpleRenderer.ts

import type { MarkdownRenderer } from './types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Минимальный inline-Markdown:
 * - **bold** → <strong>
 * - *italic* / _italic_ → <em>
 * - `code` → <code>
 * - [text](url) → <a> (только http(s), mailto, /)
 * - \n → <br>
 *
 * Порядок: escape → code → links → bold → italic → br.
 */
function render(source: string): string {
  let html = escapeHtml(source);

  // code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // links (с проверкой схемы)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text: string, url: string) => {
    if (!/^(https?:|mailto:|\/)/.test(url)) return text;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });

  // bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // italic
  html = html.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  html = html.replace(/(^|[^_])_([^_]+)_/g, '$1<em>$2</em>');

  // newlines
  html = html.replace(/\n/g, '<br>');

  return html;
}

export const simpleRenderer: MarkdownRenderer = {
  render(source) {
    if (!source) return null;
    try {
      return render(source);
    } catch {
      return null;
    }
  },
};
