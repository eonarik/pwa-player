// src/services/sort/SortService.ts

import { get, set } from 'idb-keyval'
import { ref, watch } from 'vue'
import { compareStrings } from '@/utils/sort'
import type { LibraryTrack } from '@/types/library'

export type SortField = 'artist' | 'title' | 'album' | 'duration' // 'default' убрали, так как теперь 'artist' — дефолт
export type SortDir = 'asc' | 'desc'

const STORAGE_KEY = 'player:sortSettings'

interface SortSettings {
  field: SortField
  dir: SortDir
}

export const FIELD_LABELS: Record<SortField, string> = {
  artist: 'По артисту',
  title: 'По названию',
  album: 'По альбому',
  duration: 'По длительности',
}

class SortService {
  private static instance: SortService | null = null

  readonly field = ref<SortField>('artist') // <-- По умолчанию артист
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
   * Если field === 'artist', сортирует по artist, а затем по title.
   */
  sort(tracks: LibraryTrack[]): LibraryTrack[] {
    const field = this.field.value
    const dir = this.dir.value

    const sorted = [...tracks].sort((a, b) => {
      if (field === 'duration') {
        const ad = a.duration ?? 0
        const bd = b.duration ?? 0
        return ad - bd
      }

      if (field === 'artist') {
        const aArtist = a.artist?.trim() || 'Неизвестный исполнитель'
        const bArtist = b.artist?.trim() || 'Неизвестный исполнитель'
        const cmp = compareStrings(aArtist, bArtist)

        // Если артисты одинаковые, сортируем по названию трека
        if (cmp === 0) {
          return compareStrings(a.title, b.title)
        }
        return cmp
      }

      const av = String(a[field] ?? '')
      const bv = String(b[field] ?? '')
      return compareStrings(av, bv)
    })

    return dir === 'desc' ? sorted.reverse() : sorted
  }

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
  return v === 'artist' || v === 'title' || v === 'album' || v === 'duration'
}

export const sortService = SortService.getInstance()
