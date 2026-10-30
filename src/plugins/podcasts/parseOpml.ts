// src/plugins/podcasts/parseOpml.ts

export interface OpmlFeed {
  title: string;
  feedUrl: string;
}

/**
 * Парсит OPML и возвращает список фидов (title + feedUrl).
 * Поддерживает вложенные outline.
 */
export function parseOpml(xmlText: string): OpmlFeed[] {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const feeds: OpmlFeed[] = [];
  const seen = new Set<string>();

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (child.tagName.toLowerCase() !== 'outline') continue;

      const xmlUrl = child.getAttribute('xmlUrl') || child.getAttribute('xmlurl');
      const title = child.getAttribute('title') || child.getAttribute('text') || '';

      if (xmlUrl && !seen.has(xmlUrl)) {
        seen.add(xmlUrl);
        feeds.push({ title: title.trim() || 'Без названия', feedUrl: xmlUrl.trim() });
      }

      // Вложенные папки
      walk(child);
    }
  };

  walk(doc.documentElement);
  return feeds;
}
