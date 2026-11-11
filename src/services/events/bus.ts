// src/services/events/bus.ts

import type { TrackId } from '@/types/ids';
import { logger } from '@/utils/logger';

/**
 * Типизированная шина событий ядра.
 *
 * Предназначение — разрывать зависимости «сервис → стор» и «сервис → сервис»:
 * отправитель не знает, кто слушатель, слушатель регистрируется сам.
 *
 * Новое событие добавляется в CoreEventMap — тогда проверка типов и
 * автодополнение распространяются на emit/on.
 */
export interface CoreEventMap {
  /**
   * Метаданные трека изменились (автопоиск, ID3, ручная правка, сброс).
   * Слушатели синхронизируют свои копии трека (например, очередь плеера).
   */
  'track:metadata-updated': TrackId;

  /**
   * Локальное хранилище выбрано/перевыбрано пользователем.
   * Слушатели запускают сканирование скачанных файлов.
   */
  'download:space-selected': void;
}

export type CoreEventName = keyof CoreEventMap;

export interface EventBus {
  /** Регистрирует обработчик. Возвращает функцию отписки. */
  on<K extends CoreEventName>(event: K, handler: (payload: CoreEventMap[K]) => void): () => void;
  emit<K extends CoreEventName>(event: K, payload: CoreEventMap[K]): void;
}

/** Внутренний вид обработчика: конкретный тип payload известен только на границе emit. */
type AnyHandler = (payload: never) => void;

export function createBus(): EventBus {
  const handlers = new Map<CoreEventName, Set<AnyHandler>>();

  return {
    on<K extends CoreEventName>(event: K, handler: (payload: CoreEventMap[K]) => void): () => void {
      let list = handlers.get(event);
      if (!list) {
        list = new Set();
        handlers.set(event, list);
      }
      list.add(handler as AnyHandler);

      return () => {
        const current = handlers.get(event);
        if (!current) return;
        current.delete(handler as AnyHandler);
        if (current.size === 0) handlers.delete(event);
      };
    },

    emit<K extends CoreEventName>(event: K, payload: CoreEventMap[K]): void {
      const list = handlers.get(event);
      if (!list) return;
      // Снимок списка: обработчик может отписаться или подписаться во время
      // итерации — на текущий dispatch это влиять не должно.
      for (const handler of Array.from(list)) {
        try {
          (handler as (p: CoreEventMap[K]) => void)(payload);
        } catch (err) {
          logger.error(`[eventBus] handler error on "${event}"`, err);
        }
      }
    },
  };
}

export const eventBus = createBus();
