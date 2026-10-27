// src/services/backup/BackupService.ts

import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval'
import { usePlaylistsStore } from '@/stores/playlists'
import { useHistoryStore } from '@/stores/history'
import { useDislikesStore } from '@/stores/dislikes'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { themeService, type ThemeId } from '@/services/ui/ThemeService'
import { toastService } from '@/services/ui/ToastService'
import type { PersistedSubscriptions } from '@/plugins/podcasts/types'
import { useLibraryStore } from '@/stores/library'
import type { Track } from '@/types'

export const BACKUP_FORMAT = 'cuei-backup'
export const BACKUP_VERSION = 1

export interface BackupMedia {
  playlists: unknown[]
  history: unknown[]
  dislikes: unknown[]
}

export interface BackupRadioFilters {
  topLimit: number
  topOrder: string
  topCountry: string
  topTags: string[]
}

export interface BackupRadio {
  savedStations: unknown[]
  searchQuery: string
  filters: BackupRadioFilters
}

export interface BackupPodcastFilters {
  topLimit: number
  country: string
  genre: string
}

export interface BackupPodcasts {
  subscriptions: unknown[]
  searchQuery: string
  filters: BackupPodcastFilters
}

export interface BackupSources {
  radio: BackupRadio
  podcasts: BackupPodcasts
}

export interface BackupAppSettings {
  theme: ThemeId
  showSource: boolean
  showFiles: boolean
  autoFetchMetadata: boolean
}

export interface BackupThresholds {
  metadata: number
  search: number
  playlistMatch: number
}

export interface BackupPluginFlags {
  [pluginId: string]: Record<string, boolean>
}

export interface BackupSettings {
  app: BackupAppSettings
  thresholds: BackupThresholds
  plugins: BackupPluginFlags
}

export interface CueiBackup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  data: {
    media?: BackupMedia
    sources?: BackupSources
    settings?: BackupSettings
  }
}

export type BackupDomain = 'media' | 'sources' | 'settings'
export const ALL_DOMAINS: BackupDomain[] = ['media', 'sources', 'settings']

const PLUGIN_STORAGE_KEYS: Record<string, string[]> = {
  'yandex-self': ['plugin-activated:yandex-self', 'yandex-self-disconnected'],
  local: ['local-connected'],
  yandex: ['yandex-disconnected'],
}

class BackupService {
  private static instance: BackupService | null = null

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService()
    }
    return BackupService.instance
  }

  // --- Экспорт --------------------------------------------------------

  async exportAll(domains: BackupDomain[] = ALL_DOMAINS): Promise<CueiBackup> {
    const data: CueiBackup['data'] = {}

    if (domains.includes('media')) data.media = this.collectMedia()
    if (domains.includes('sources')) data.sources = await this.collectSources()
    if (domains.includes('settings')) data.settings = this.collectSettings()

    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    }
  }

  private collectMedia(): BackupMedia {
    const playlists = usePlaylistsStore()
    const history = useHistoryStore()
    const dislikes = useDislikesStore()
    return {
      playlists: Object.values(playlists.playlists),
      history: history.sortedHistory,
      dislikes: dislikes.sortedEntries,
    }
  }

  private async collectSources(): Promise<BackupSources> {
    const radioFilters: BackupRadioFilters = {
      topLimit: Number(localStorage.getItem('radio:topLimit') || 15),
      topOrder: localStorage.getItem('radio:topOrder') || 'clickCount',
      topCountry: localStorage.getItem('radio:topCountry') || '',
      topTags: JSON.parse(localStorage.getItem('radio:topTags') || '[]'),
    }

    const podcastFilters: BackupPodcastFilters = {
      topLimit: Number(localStorage.getItem('podcasts:topLimit') || 15),
      country: localStorage.getItem('podcasts:country') || 'ru',
      genre: localStorage.getItem('podcasts:genre') || '',
    }

    const podcastsData = await idbGet<PersistedSubscriptions>('podcasts:subscriptions')

    return {
      radio: {
        savedStations: JSON.parse(localStorage.getItem('radio:saved-stations') || '[]'),
        searchQuery: localStorage.getItem('radio:searchQuery') || '',
        filters: radioFilters,
      },
      podcasts: {
        subscriptions: podcastsData?.subscriptions ?? [],
        searchQuery: localStorage.getItem('podcasts:searchQuery') || '',
        filters: podcastFilters,
      },
    }
  }

  private collectSettings(): BackupSettings {
    const uiSettings = useUiSettingsStore()

    const pluginFlags: BackupPluginFlags = {}
    for (const [pluginId, keys] of Object.entries(PLUGIN_STORAGE_KEYS)) {
      pluginFlags[pluginId] = {}
      for (const key of keys) {
        const value = localStorage.getItem(key)
        if (value === null) continue
        const flagName = key.split(':').pop() || key
        pluginFlags[pluginId][flagName] = value === 'true'
      }
    }

    return {
      app: {
        theme: themeService.current.value,
        showSource: uiSettings.showSource,
        showFiles: uiSettings.showFiles,
        autoFetchMetadata: uiSettings.autoFetchMetadata,
      },
      thresholds: {
        metadata: uiSettings.metadataThreshold,
        search: uiSettings.searchThreshold,
        playlistMatch: uiSettings.playlistMatchThreshold,
      },
      plugins: pluginFlags,
    }
  }

  // --- Импорт ---------------------------------------------------------

  validate(raw: unknown): CueiBackup {
    if (!raw || typeof raw !== 'object') throw new Error('Файл не является JSON-объектом')
    const data = raw as CueiBackup
    if (data.format !== BACKUP_FORMAT) throw new Error('Неверный формат бэкапа')
    if (typeof data.version !== 'number') throw new Error('Неверная версия бэкапа')
    if (!data.data) throw new Error('Отсутствует секция data')
    return data
  }

  async importAll(raw: unknown, domains: BackupDomain[] = ALL_DOMAINS): Promise<void> {
    const backup = this.validate(raw)

    if (domains.includes('media') && backup.data.media) {
      this.importMedia(backup.data.media)
    }
    if (domains.includes('sources') && backup.data.sources) {
      await this.importSources(backup.data.sources)
    }
    if (domains.includes('settings') && backup.data.settings) {
      await this.importSettings(backup.data.settings)
    }

    await idbDel('player:state')
    await idbDel('player:playback')

    toastService.success('Импорт завершён. Страница перезагрузится.')
    setTimeout(() => window.location.reload(), 1000)
  }

  private importMedia(media: BackupMedia): void {
    const playlists = usePlaylistsStore()
    const history = useHistoryStore()
    const dislikes = useDislikesStore()
    const library = useLibraryStore()

    if (Array.isArray(media.playlists)) {
      playlists.playlists = {}
      for (const p of media.playlists as Array<Record<string, unknown>>) {
        const id = String(p.id ?? '')
        if (!id) continue

        let trackIds: string[] = []
        if (Array.isArray(p.trackIds)) {
          trackIds = p.trackIds as string[]
        } else if (Array.isArray(p.tracks)) {
          // Миграция старого формата (снимки -> trackIds + виртуальные треки)
          for (const snapshot of p.tracks as Array<Record<string, unknown>>) {
            if (snapshot.id && typeof snapshot.id === 'string') {
              if (!library.getTrack(snapshot.id)) {
                library.resolveOrCreateTrack({
                  ...(snapshot as unknown as Track),
                  // folderId и isVirtual проставятся внутри resolveOrCreateTrack
                })
              }
              trackIds.push(snapshot.id)
            }
          }
        }

        playlists.playlists[id] = {
          id,
          name: String(p.name ?? 'Без названия'),
          trackIds: Array.from(new Set(trackIds)),
          createdAt: Number(p.createdAt ?? Date.now()),
          updatedAt: Number(p.updatedAt ?? Date.now()),
        }
      }
      playlists.save()
    }

    if (Array.isArray(media.history)) {
      const newEntries: Array<{ trackId: string; playedAt: number }> = []
      for (const e of media.history as Array<Record<string, unknown>>) {
        if (typeof e.trackId === 'string') {
          newEntries.push({ trackId: e.trackId, playedAt: Number(e.playedAt ?? Date.now()) })
        } else if (typeof e.id === 'string') {
          if (!library.getTrack(e.id)) {
            library.resolveOrCreateTrack({
              ...(e as unknown as Track),
            })
          }
          newEntries.push({ trackId: e.id, playedAt: Number(e.playedAt ?? Date.now()) })
        }
      }
      history.entries = newEntries
      history.save()
    }

    if (Array.isArray(media.dislikes)) {
      const newEntries: Array<{ trackId: string; dislikedAt: number }> = []
      for (const e of media.dislikes as Array<Record<string, unknown>>) {
        if (typeof e.trackId === 'string') {
          newEntries.push({ trackId: e.trackId, dislikedAt: Number(e.dislikedAt ?? Date.now()) })
        } else if (typeof e.id === 'string') {
          if (!library.getTrack(e.id)) {
            library.resolveOrCreateTrack({
              ...(e as unknown as Track),
            })
          }
          newEntries.push({ trackId: e.id, dislikedAt: Number(e.dislikedAt ?? Date.now()) })
        }
      }
      dislikes.entries = newEntries
      dislikes.save()
    }
  }

  private async importSources(sources: BackupSources): Promise<void> {
    if (sources.radio) {
      localStorage.setItem(
        'radio:saved-stations',
        JSON.stringify(sources.radio.savedStations ?? []),
      )
      localStorage.setItem('radio:searchQuery', sources.radio.searchQuery ?? '')
      if (sources.radio.filters) {
        localStorage.setItem('radio:topLimit', String(sources.radio.filters.topLimit ?? 15))
        localStorage.setItem('radio:topOrder', sources.radio.filters.topOrder ?? 'clickCount')
        localStorage.setItem('radio:topCountry', sources.radio.filters.topCountry ?? '')
        localStorage.setItem('radio:topTags', JSON.stringify(sources.radio.filters.topTags ?? []))
      }
    }

    if (sources.podcasts) {
      await idbSet('podcasts:subscriptions', {
        subscriptions: sources.podcasts.subscriptions ?? [],
        savedAt: Date.now(),
      } as PersistedSubscriptions)

      localStorage.removeItem('podcasts:subscriptions')
      localStorage.setItem('podcasts:searchQuery', sources.podcasts.searchQuery ?? '')
      if (sources.podcasts.filters) {
        localStorage.setItem('podcasts:topLimit', String(sources.podcasts.filters.topLimit ?? 15))
        localStorage.setItem('podcasts:country', sources.podcasts.filters.country ?? 'ru')
        localStorage.setItem('podcasts:genre', sources.podcasts.filters.genre ?? '')
      }
    }
  }

  private async importSettings(settings: BackupSettings): Promise<void> {
    const uiSettings = useUiSettingsStore()

    if (settings.app) {
      if (settings.app.theme) themeService.apply(settings.app.theme)
      if (typeof settings.app.showSource === 'boolean')
        uiSettings.showSource = settings.app.showSource
      if (typeof settings.app.showFiles === 'boolean') uiSettings.showFiles = settings.app.showFiles
      if (typeof settings.app.autoFetchMetadata === 'boolean') {
        uiSettings.autoFetchMetadata = settings.app.autoFetchMetadata
      }
    }

    if (settings.thresholds) {
      if (typeof settings.thresholds.metadata === 'number') {
        uiSettings.metadataThreshold = settings.thresholds.metadata
      }
      if (typeof settings.thresholds.search === 'number') {
        uiSettings.searchThreshold = settings.thresholds.search
      }
      if (typeof settings.thresholds.playlistMatch === 'number') {
        uiSettings.playlistMatchThreshold = settings.thresholds.playlistMatch
      }
    }

    if (settings.plugins) {
      for (const [pluginId, flags] of Object.entries(settings.plugins)) {
        const keys = PLUGIN_STORAGE_KEYS[pluginId]
        if (!keys) continue
        for (const key of keys) {
          const flagName = key.split(':').pop() || key
          if (typeof flags[flagName] === 'boolean') {
            localStorage.setItem(key, flags[flagName] ? 'true' : 'false')
          }
        }
      }
    }

    await uiSettings.flush()
  }
}

export const backupService = BackupService.getInstance()
