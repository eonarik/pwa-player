// src/plugins/yandexSelf/logii/parseLogii.ts

export interface LogiiComment {
  nickname: string;
  time: string | null;
  text: string;
}

export interface LogiiData {
  vibe: string;
  comments: LogiiComment[];
}

export function parseLogii(content: string): LogiiData {
  const normalized = content.replace(/\r\n/g, '\n');

  const dividerIndex = normalized.indexOf('\n===\n');
  if (dividerIndex === -1) {
    return parseLegacy(normalized);
  }

  const vibe = normalized.slice(0, dividerIndex).trim();
  const commentsPart = normalized.slice(dividerIndex + '\n===\n'.length);

  const comments: LogiiComment[] = [];
  const blocks = commentsPart.split(/\n---\n/);

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    const lines = block.split('\n');
    const header = lines[0] ?? '';
    const match = header.match(/^(.+?)(?:\s+\((.+?)\))?:\s*$/);
    if (!match) continue;

    comments.push({
      nickname: match[1]!.trim(),
      time: match[2]?.trim() ?? null,
      text: lines.slice(1).join('\n').trim(),
    });
  }

  return { vibe, comments };
}

/**
 * Legacy (до 0.17.0):
 * Всё до первого `<nickname>:` — vibe. `<nickname>:` — комментарии.
 * Дата в скобках не парсится (попадает в nickname).
 *
 * Если vibe пустой (файл начинается с `<nickname>:`), первый комментарий
 * становится vibe (nickname отбрасывается).
 */
function parseLegacy(content: string): LogiiData {
  const normalized = content.replace(/\r\n/g, '\n');
  const headerRe = /^([^\n:]+?):/gm;

  const matches: Array<{ nickname: string; start: number; headerEnd: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(normalized)) !== null) {
    matches.push({
      nickname: m[1]!.trim(),
      start: m.index,
      headerEnd: m.index + m[0].length,
    });
  }

  if (matches.length === 0) {
    return { vibe: normalized.trim(), comments: [] };
  }

  let vibe = normalized.slice(0, matches[0]!.start).trim();

  const comments: LogiiComment[] = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i]!;
    const nextStart = matches[i + 1]?.start ?? normalized.length;
    comments.push({
      nickname: cur.nickname,
      time: null,
      text: normalized.slice(cur.headerEnd, nextStart).trim(),
    });
  }

  // Если vibe пустой — первый комментарий становится vibe.
  if (!vibe && comments.length > 0) {
    const first = comments.shift()!;
    vibe = first.text;
  }

  return { vibe, comments };
}

export function stringifyLogii(data: LogiiData): string {
  const parts: string[] = [];
  if (data.vibe.trim()) parts.push(data.vibe.trim());
  parts.push('===');

  for (const c of data.comments) {
    const header = c.time ? `${c.nickname} (${c.time}):` : `${c.nickname}:`;
    parts.push(header);
    parts.push(c.text.trim());
    parts.push('---');
  }

  if (parts[parts.length - 1] === '---') parts.pop();

  return parts.join('\n');
}
