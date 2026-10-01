// src/services/sort/SortService.ts

import { get, set } from 'idb-keyval'
import { ref, watch } from 'vue'
import { compareStrings } from '@/utils/sort'
import type { LibraryTrack } from '@/types/library'

export type SortField = 'default' | 'title' | 'artist' | 'album' | 'duration'
export type SortDir = 'asc' | 'desc'

const STORAGE_KEY = 'player:sortSettings'

interface SortSettings {
  field: SortField
  dir: SortDir
}

export const FIELD_LABELS: Record<SortField, string> = {
  default: 'По умолчанию',
  title: 'По названию',
  artist: 'По артисту',
  album: 'По альбому',
  duration: 'По длительности',
}

class SortService {
  private static instance: SortService | null = null

  readonly field = ref<SortField>('default')
  readonly dir = ref<SortDir>('asc')

  private loaded = false

  static getInstance(): SortService {
    if (!SortService.instance) {
      SortService.instance = new SortService()
    }
    return SortService.instance
  }

  private constructor() {
    watch([this.field, this.dir], () => this.save())
  }

  /** Загрузить настройки из IDB. Вызывать при старте приложения. */
  async load(): Promise<void> {
    if (this.loaded) return
    try {
      const raw = await get<SortSettings>(STORAGE_KEY)
      if (raw) {
        if (isSortField(raw.field)) this.field.value = raw.field
        if (raw.dir === 'asc' || raw.dir === 'desc') this.dir.value = raw.dir
      }
    } catch (err) {
      console.warn('[sort] failed to load', err)
    } finally {
      this.loaded = true
    }
  }

  private async save(): Promise<void> {
    if (!this.loaded) return
    try {
      await set(STORAGE_KEY, {
        field: this.field.value,
        dir: this.dir.value,
      })
    } catch (err) {
      console.warn('[sort] failed to save', err)
    }
  }

  setField(field: SortField): void {
    this.field.value = field
  }

  setDir(dir: SortDir): void {
    this.dir.value = dir
  }

  toggleDir(): void {
    this.dir.value = this.dir.value === 'asc' ? 'desc' : 'asc'
  }

  /**
   * Сортирует массив треков.
   * Поле field сохраняется для будущих фич, но UI сейчас не даёт его менять.
   * По умолчанию (field === 'default') — по title.
   */
  sort(tracks: LibraryTrack[]): LibraryTrack[] {
    const field = this.field.value
    const dir = this.dir.value

    const sorted = [...tracks].sort((a, b) => {
      if (field === 'default') {
        return compareStrings(a.title, b.title)
      }

      if (field === 'duration') {
        const ad = a.duration ?? 0
        const bd = b.duration ?? 0
        return ad - bd
      }

      const av = String(a[field] ?? '')
      const bv = String(b[field] ?? '')
      return compareStrings(av, bv)
    })

    return dir === 'desc' ? sorted.reverse() : sorted
  }

  /** Сортирует массив объектов с именем (папки, файлы). */
  sortByName<T extends { name: string }>(items: T[]): T[] {
    const dir = this.dir.value
    const sorted = [...items].sort((a, b) => compareStrings(a.name, b.name))
    return dir === 'desc' ? sorted.reverse() : sorted
  }

  get fieldLabel(): string {
    return FIELD_LABELS[this.field.value]
  }

  get dirLabel(): string {
    return this.dir.value === 'asc' ? 'По возрастанию' : 'По убыванию'
  }
}

function isSortField(v: unknown): v is SortField {
  return v === 'default' || v === 'title' || v === 'artist' || v === 'album' || v === 'duration'
}

export const sortService = SortService.getInstance()
