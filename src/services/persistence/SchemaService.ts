// src/services/persistence/SchemaService.ts

import { get, set, del, clear, createStore } from 'idb-keyval'
import { SCHEMA_VERSION, SCHEMA_VERSION_KEY } from './schema'

/**
 * Отдельный store для служебных ключей.
 * idb-keyval по умолчанию использует БД 'keyval-store' и store 'keyval'.
 * Мы не будем это менять — все ключи живут там же.
 */
const store = createStore('keyval-store', 'keyval')

export class SchemaService {
  private static instance: SchemaService | null = null

  static getInstance(): SchemaService {
    if (!SchemaService.instance) {
      SchemaService.instance = new SchemaService()
    }
    return SchemaService.instance
  }

  /**
   * Проверяет совместимость сохранённых данных с текущей схемой.
   * Если версия не совпадает — чистит всё.
   *
   * Возвращает true, если данные были стёрты (значит, нужно
   * перестроить всё с нуля — например, заново выбрать папку).
   */
  async ensureCompatible(): Promise<boolean> {
    let savedVersion: number | undefined

    try {
      savedVersion = await get<number>(SCHEMA_VERSION_KEY, store)
    } catch (err) {
      console.warn('[SchemaService] failed to read schema version', err)
    }

    // Первый запуск — просто записываем текущую версию
    if (savedVersion === undefined) {
      await this.writeVersion()
      return false
    }

    // Совпадает — ничего не делаем
    if (savedVersion === SCHEMA_VERSION) {
      return false
    }

    // Не совпадает — чистим всё
    console.warn(
      `[SchemaService] schema changed: ${savedVersion} → ${SCHEMA_VERSION}. Clearing IDB.`,
    )
    await this.clearAll()
    await this.writeVersion()
    return true
  }

  /**
   * Полная очистка IDB.
   * Удаляет всё: состояние плеера, хэндл папки, служебные ключи.
   */
  async clearAll(): Promise<void> {
    try {
      // clear() без аргументов чистит весь store
      await clear(store)
    } catch (err) {
      console.error('[SchemaService] failed to clear IDB', err)
      throw err
    }
  }

  private async writeVersion(): Promise<void> {
    try {
      await set(SCHEMA_VERSION_KEY, SCHEMA_VERSION, store)
    } catch (err) {
      console.error('[SchemaService] failed to write schema version', err)
    }
  }
}

export const schemaService = SchemaService.getInstance()
