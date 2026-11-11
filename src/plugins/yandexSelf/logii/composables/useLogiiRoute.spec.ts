// src/plugins/yandexSelf/logii/composables/useLogiiRoute.spec.ts

import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useLogiiRoute } from './useLogiiRoute';

describe('useLogiiRoute', () => {
  it('разбирает сезон, автора и папку', () => {
    const route = useLogiiRoute(ref('logii.2024-11-08/userA/3'));
    expect(route.seasonUrlPath.value).toBe('logii.2024-11-08');
    expect(route.authorName.value).toBe('userA');
    expect(route.folderName.value).toBe('3');
  });

  it('сегменты до маркера сезона образуют путь родителя', () => {
    const route = useLogiiRoute(ref('a/b/logii.S/u'));
    expect(route.seasonIndex.value).toBe(2);
    expect(route.seasonUrlPath.value).toBe('a/b/logii.S');
  });

  it('без маркера logii. возвращает пустой путь и null-имена', () => {
    const route = useLogiiRoute(ref('a/b'));
    expect(route.seasonIndex.value).toBe(-1);
    expect(route.seasonUrlPath.value).toBe('');
    expect(route.authorName.value).toBeNull();
    expect(route.folderName.value).toBeNull();
  });

  it('только сезон: автор и папка отсутствуют', () => {
    const route = useLogiiRoute(ref('logii.S'));
    expect(route.seasonUrlPath.value).toBe('logii.S');
    expect(route.authorName.value).toBeNull();
    expect(route.folderName.value).toBeNull();
  });

  it('пересчитывается при смене urlPath', () => {
    const path = ref('logii.S/u1');
    const route = useLogiiRoute(path);
    expect(route.authorName.value).toBe('u1');

    path.value = 'logii.S/u2/f9';
    expect(route.authorName.value).toBe('u2');
    expect(route.folderName.value).toBe('f9');
  });
});
