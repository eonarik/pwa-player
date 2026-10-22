<!-- src/plugins/radio/RadioCatalog.vue -->
<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { radioService, type RadioStation, type RadioSortOrder, type RadioTag } from './RadioService'
import { type SavedStation } from './index'
import RadioFilters, { type RadioCountryEntry } from './RadioFilters.vue'
import CatalogLayout from '@/components/catalog/CatalogLayout.vue'
import AddRemoveButton from '@/components/ui/AddRemoveButton.vue'
import IconRadio from '@/components/icons/IconRadio.vue'
import IconPlay from '@/components/icons/IconPlay.vue'

const props = defineProps<{
  savedStationIds: Set<string>
  currentTrackId: string | null
  isPlaying: boolean
}>()

const emit = defineEmits<{
  (e: 'add', station: SavedStation): void
  (e: 'play', station: SavedStation): void
  (e: 'remove', station: SavedStation): void
  (e: 'back'): void
}>()

const ORDER_LABELS: Record<RadioSortOrder, string> = {
  clickCount: 'Топ чарт',
  votes: 'По голосам',
  clickTrend: 'В тренде',
  bitrate: 'По качеству',
  random: 'Случайные',
  name: 'По алфавиту',
}

const SEARCH_STORAGE_KEY = 'radio:searchQuery'

const searchQuery = ref(localStorage.getItem(SEARCH_STORAGE_KEY) ?? '')
const debouncedSearchQuery = ref(searchQuery.value)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const topLimit = ref(Number(localStorage.getItem('radio:topLimit')) || 15)
const topOrder = ref<RadioSortOrder>((localStorage.getItem('radio:topOrder') as RadioSortOrder) || 'clickCount')
const topCountry = ref(localStorage.getItem('radio:topCountry') || '')
const topTags = ref<string[]>(JSON.parse(localStorage.getItem('radio:topTags') || '[]'))

const currentPage = ref(1)
const hasMore = ref(true)

const countries = ref<RadioCountryEntry[]>([])
const tags = ref<RadioTag[]>([])
const countriesError = ref(false)
const tagsError = ref(false)

const isLoading = ref(false)
const isStale = ref(false)
const error = ref('')
const stations = ref<RadioStation[]>([])

const isSearchMode = computed(() => debouncedSearchQuery.value.trim().length > 0)
const hasFilters = computed(() => Boolean(topCountry.value) || topTags.value.length > 0)

const listTitle = computed(() => {
  if (isSearchMode.value) return `Результаты поиска: «${debouncedSearchQuery.value.trim()}»`
  if (!hasFilters.value) return `Топ: ${ORDER_LABELS[topOrder.value]}`
  return 'Топ по фильтрам'
})

function isSaved(id: string): boolean { return props.savedStationIds.has(id) }
function isCurrent(id: string): boolean { return props.currentTrackId === `radio:${id}` }
function isStationPlaying(id: string): boolean { return isCurrent(id) && props.isPlaying }

function toSaved(s: RadioStation): SavedStation {
  return { id: s.id, name: s.name, url: s.url, favicon: s.favicon }
}

function onAddClick(s: RadioStation): void { if (!isSaved(s.id)) emit('add', toSaved(s)) }
function onPlayClick(s: RadioStation): void { emit('play', toSaved(s)) }
function onRemoveClick(s: RadioStation): void { emit('remove', toSaved(s)) }

async function loadCountries(): Promise<void> {
  countriesError.value = false
  const res = await radioService.getCountries()
  if (res === null) { countriesError.value = true; return }
  countries.value = res
}

async function loadTags(): Promise<void> {
  tagsError.value = false
  const res = await radioService.getTags(100)
  if (res === null) { tagsError.value = true; return }
  tags.value = res
}

async function loadStations(): Promise<void> {
  isLoading.value = true
  isStale.value = false
  error.value = ''
  try {
    const limit = topLimit.value
    const offset = (currentPage.value - 1) * limit
    const query = debouncedSearchQuery.value.trim()

    let result: { stations: RadioStation[]; total: number }

    if (query) {
      result = await radioService.searchByName(query, limit, {
        countryCode: topCountry.value || undefined,
        tags: topTags.value,
        order: topOrder.value,
      })
    } else {
      result = await radioService.getTopStations(limit, offset, topOrder.value, topCountry.value || undefined, topTags.value)
    }

    stations.value = result.stations
    hasMore.value = result.total >= limit * 3
    isStale.value = radioService.isStale
    if (result.stations.length === 0) error.value = 'Ничего не найдено'
  } catch {
    stations.value = []
    error.value = 'Ошибка загрузки'
  } finally {
    isLoading.value = false
  }
}

watch(searchQuery, (value) => {
  localStorage.setItem(SEARCH_STORAGE_KEY, value)
  if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    searchDebounceTimer = null
    const next = value.trim()
    if (next === debouncedSearchQuery.value.trim()) return
    debouncedSearchQuery.value = value
    currentPage.value = 1
    void loadStations()
  }, 500)
})

watch([topOrder, topCountry, topTags, topLimit], () => {
  localStorage.setItem('radio:topOrder', topOrder.value)
  localStorage.setItem('radio:topCountry', topCountry.value)
  localStorage.setItem('radio:topTags', JSON.stringify(topTags.value))
  localStorage.setItem('radio:topLimit', String(topLimit.value))
  currentPage.value = 1
  void loadStations()
}, { deep: true })

watch(currentPage, () => { void loadStations() })

onMounted(async () => {
  await Promise.all([loadCountries(), loadTags()])
  void loadStations()
})

function clearSearch(): void {
  searchQuery.value = ''
  debouncedSearchQuery.value = ''
  localStorage.removeItem(SEARCH_STORAGE_KEY)
  currentPage.value = 1
  void loadStations()
}
</script>

<template>
  <CatalogLayout title="Выбор станций" back-label="К выбранным станциям" :list-title="listTitle"
    :search-query="searchQuery" :show-clear="isSearchMode" :is-loading="isLoading" :is-stale="isStale" :error="error"
    :is-empty="stations.length === 0 && !isLoading && !error" :current-limit="topLimit" :current-page="currentPage"
    :has-more="hasMore" :show-pagination="stations.length > 0" @update:search-query="(v) => (searchQuery = v)"
    @clear="clearSearch" @back="emit('back')" @update:current-limit="(v) => (topLimit = v)" @prev="currentPage--"
    @next="currentPage++">
    <template #filters>
      <RadioFilters v-model:top-order="topOrder" v-model:top-country="topCountry" v-model:top-tags="topTags"
        :countries="countries" :tags="tags" :countries-error="countriesError" :tags-error="tagsError"
        @retry-countries="loadCountries" @retry-tags="loadTags" />
    </template>

    <template #list>
      <div v-for="station in stations" :key="station.id"
        class="flex items-center justify-between gap-3 rounded-btn px-3 py-2 transition"
        :class="isCurrent(station.id) ? 'bg-active/10' : 'hover:bg-hover-bg'">
        <button type="button" class="flex items-center gap-3 min-w-0 flex-1 text-left" @click="onPlayClick(station)">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-card-bg">
            <img v-if="station.favicon" :src="station.favicon" class="h-full w-full object-cover"
              @error="($event.target as HTMLImageElement).style.display = 'none'" />
            <IconRadio v-else class="h-5 w-5 text-fg-muted" />
          </div>
          <div class="min-w-0">
            <span class="text-sm text-fg truncate block">{{ station.name }}</span>
            <span v-if="station.country" class="text-[10px] text-fg-muted truncate block">{{ station.country }}</span>
          </div>
        </button>
        <div class="flex shrink-0 items-center gap-1">
          <button v-if="isStationPlaying(station.id)" type="button"
            class="rounded-btn px-1 py-1.5 text-active transition hover:bg-hover-bg" aria-label="Пауза"
            v-tooltip="'Пауза'" @click="onPlayClick(station)">
            <div class="flex items-center justify-center gap-0.5 w-4 h-4">
              <span class="h-3 w-0.5 animate-pulse bg-active" />
              <span class="h-4 w-0.5 animate-pulse bg-active [animation-delay:150ms]" />
              <span class="h-2 w-0.5 animate-pulse bg-active [animation-delay:300ms]" />
            </div>
          </button>
          <button v-else type="button" class="rounded-btn p-1.5 transition"
            :class="isCurrent(station.id) ? 'text-active hover:bg-hover-bg' : 'text-fg-subtle hover:bg-hover-bg hover:text-fg'"
            :aria-label="isCurrent(station.id) ? 'Пауза' : 'Играть'"
            v-tooltip="isCurrent(station.id) ? 'Пауза' : 'Играть'" @click="onPlayClick(station)">
            <IconPlay class="h-4 w-4" />
          </button>
          <AddRemoveButton :added="isSaved(station.id)" @add="onAddClick(station)" @remove="onRemoveClick(station)" />
        </div>
      </div>
    </template>
  </CatalogLayout>
</template>
