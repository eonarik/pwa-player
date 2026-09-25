// src/services/persistence/lastSource.ts

import { get, set, del } from 'idb-keyval'

const LAST_SOURCE_KEY = 'player:lastSource'

export type LastSource = 'local' | 'yandex'

export async function saveLastSource(source: LastSource | null): Promise<void> {
  try {
    if (source === null) {
      await del(LAST_SOURCE_KEY)
      return
    }
    await set(LAST_SOURCE_KEY, source)
  } catch (err) {
    console.warn('[lastSource] failed to save', err)
  }
}

export async function loadLastSource(): Promise<LastSource | null> {
  try {
    const value = await get<LastSource>(LAST_SOURCE_KEY)
    return value ?? null
  } catch (err) {
    console.warn('[lastSource] failed to load', err)
    return null
  }
}
