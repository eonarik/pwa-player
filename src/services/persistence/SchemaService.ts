// src/services/persistence/SchemaService.ts

import { get, set, clear } from 'idb-keyval';
import { SCHEMA_VERSION, SCHEMA_VERSION_KEY } from './schema';

export class SchemaService {
  private static instance: SchemaService | null = null;

  static getInstance(): SchemaService {
    if (!SchemaService.instance) {
      SchemaService.instance = new SchemaService();
    }
    return SchemaService.instance;
  }

  async ensureCompatible(): Promise<boolean> {
    let savedVersion: number | undefined;

    try {
      savedVersion = await get<number>(SCHEMA_VERSION_KEY);
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
      await clear();
    } catch (err) {
      console.warn('[SchemaService] failed to clear store', err);
    }
  }

  private async writeVersion(): Promise<void> {
    try {
      await set(SCHEMA_VERSION_KEY, SCHEMA_VERSION);
    } catch (err) {
      console.error('[SchemaService] failed to write schema version', err);
    }
  }
}

export const schemaService = SchemaService.getInstance();
