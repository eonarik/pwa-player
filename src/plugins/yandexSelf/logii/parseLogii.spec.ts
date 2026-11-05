// src/plugins/yandexSelf/logii/parseLogii.spec.ts

import { describe, it, expect } from 'vitest';
import { parseLogii, stringifyLogii, type LogiiData } from './parseLogii';

describe('parseLogii', () => {
  it('возвращает vibe без комментариев, если нет ===', () => {
    const result = parseLogii('Какой-то вайб');
    expect(result.vibe).toBe('Какой-то вайб');
    expect(result.comments).toEqual([]);
  });

  it('парсит vibe + один комментарий с временем', () => {
    const text = `Вайб трека

===

userA (2024-11-08 20:15):
Текст комментария`;
    const result = parseLogii(text);
    expect(result.vibe).toBe('Вайб трека');
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]).toEqual({
      nickname: 'userA',
      time: '2024-11-08 20:15',
      text: 'Текст комментария',
    });
  });

  it('парсит несколько комментариев (разделитель ---)', () => {
    const text = `Вайб

===

userA:
Первый
---
userB (2024-11-08):
Второй`;
    const result = parseLogii(text);
    expect(result.comments).toHaveLength(2);
    expect(result.comments[0]!.nickname).toBe('userA');
    expect(result.comments[0]!.time).toBeNull();
    expect(result.comments[0]!.text).toBe('Первый');
    expect(result.comments[1]!.nickname).toBe('userB');
    expect(result.comments[1]!.time).toBe('2024-11-08');
    expect(result.comments[1]!.text).toBe('Второй');
  });

  it('многострочный текст комментария', () => {
    const text = `v

===

userA:
строка 1
строка 2`;
    const result = parseLogii(text);
    expect(result.comments[0]!.text).toBe('строка 1\nстрока 2');
  });

  it('пустые блоки игнорируются', () => {
    const text = `v

===

userA:
text
---
---
---
`;
    const result = parseLogii(text);
    expect(result.comments).toHaveLength(1);
  });
});

describe('stringifyLogii', () => {
  it('roundtrip: parse(stringify(data)) === data', () => {
    const data: LogiiData = {
      vibe: 'Вайб',
      comments: [
        { nickname: 'userA', time: '2024-11-08 20:15', text: 'Первый' },
        { nickname: 'userB', time: null, text: 'Второй' },
      ],
    };
    const text = stringifyLogii(data);
    const parsed = parseLogii(text);
    expect(parsed.vibe).toBe('Вайб');
    expect(parsed.comments).toHaveLength(2);
    expect(parsed.comments[0]!.nickname).toBe('userA');
    expect(parsed.comments[0]!.time).toBe('2024-11-08 20:15');
    expect(parsed.comments[1]!.nickname).toBe('userB');
    expect(parsed.comments[1]!.time).toBeNull();
  });

  it('пустой vibe и пустые комментарии', () => {
    const text = stringifyLogii({ vibe: '', comments: [] });
    expect(text).toBe('===');
  });
});
