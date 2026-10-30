// src/services/persistence/SchemaService.ts

import { get, set, clear, createStore } from 'idb-keyval';
import { SCHEMA_VERSION, SCHEMA_VERSION_KEY } from './schema';

const store = createStore('keyval-store', 'keyval');

export class SchemaService {
  private static instance: SchemaService | null = null;

  static getInstance(): SchemaService {
    if (!SchemaService.instance) {
      SchemaService.instance = new SchemaService();
    }
    return SchemaService.instance;
  }

  /**
   * Принудительно инициализирует базу cuei-plugins и store 'init'.
   * Это предотвращает ошибку NotFoundError при первом сохранении данных плагина.
   */
  async initPluginStores(): Promise<void> {
    try {
      const pluginStore = createStore('cuei-plugins', 'init');
      await set('init', true, pluginStore);
    } catch (err) {
      console.warn('[SchemaService] failed to init plugins store', err);
    }
  }

  async ensureCompatible(): Promise<boolean> {
    let savedVersion: number | undefined;

    try {
      savedVersion = await get<number>(SCHEMA_VERSION_KEY, store);
    } catch (err) {
      console.warn('[SchemaService] failed to read schema version', err);
    }

    if (savedVersion === undefined) {
      await this.writeVersion();
      return false;
    }

    if (savedVersion === SCHEMA_VERSION) {
      return false;
    }

    console.warn(`[SchemaService] schema changed: ${savedVersion} → ${SCHEMA_VERSION}. Clearing IDB.`);
    await this.clearAll();
    await this.writeVersion();
    return true;
  }

  async clearAll(): Promise<void> {
    try {
      await clear(store); // Чистим main store
    } catch (err) {
      console.warn('[SchemaService] failed to clear main store', err);
    }
  }

  private async writeVersion(): Promise<void> {
    try {
      await set(SCHEMA_VERSION_KEY, SCHEMA_VERSION, store);
    } catch (err) {
      console.error('[SchemaService] failed to write schema version', err);
    }
  }
}

export const schemaService = SchemaService.getInstance();
