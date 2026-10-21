<!-- src/plugins/radio/RadioCatalog.vue -->
<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import {
  radioService,
  type RadioStation,
  type RadioSortOrder,
  type RadioTag,
} from './RadioService'
import { type SavedStation } from './index'
import RadioFilters, { type RadioCountryEntry } from './RadioFilters.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import IconSpinner from '@/components/icons/IconSpinner.vue'
import IconRadio from '@/components/icons/IconRadio.vue'
import IconPlus from '@/components/icons/IconPlus.vue'
import IconPlay from '@/components/icons/IconPlay.vue'
import IconX from '@/components/icons/IconX.vue'
import IconChevronDown from '@/components/icons/IconChevronDown.vue'
import IconChevronLeft from '@/components/icons/IconChevronLeft.vue'
import IconChevronRight from '@/components/icons/IconChevronRight.vue'
import IconArrowLeft from '@/components/icons/IconArrowLeft.vue'
import SectionTitle from "@/components/ui/SectionTitle.vue"

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
const topOrder = ref<RadioSortOrder>(
  (localStorage.getItem('radio:topOrder') as RadioSortOrder) || 'clickCount',
)
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
const fallbackNotice = ref<string | null>(null)
const stations = ref<RadioStation[]>([])

const isMobileFiltersOpen = ref(false)

const isSearchMode = computed(() => debouncedSearchQuery.value.trim().length > 0)
const hasFilters = computed(() => Boolean(topCountry.value) || topTags.value.length > 0)

const listTitle = computed(() => {
  if (isSearchMode.value) {
    return `Результаты поиска: «${debouncedSearchQuery.value.trim()}»`
  }

  if (!hasFilters.value) {
    return `Топ: ${ORDER_LABELS[topOrder.value]}`
  }

  return 'Топ по фильтрам'
})

function isSaved(stationId: string): boolean {
  return props.savedStationIds.has(stationId)
}

function toSaved(station: RadioStation): SavedStation {
  return {
    id: station.id,
    name: station.name,
    url: station.url,
    favicon: station.favicon,
  }
}

function onAddClick(station: RadioStation): void {
  if (isSaved(station.id)) return
  emit('add', toSaved(station))
}

function onPlayClick(station: RadioStation): void {
  emit('play', toSaved(station))
}

function onRemoveClick(station: RadioStation): void {
  emit('remove', toSaved(station))
}

async function loadCountries() {
  countriesError.value = false
  const res = await radioService.getCountries()
  if (res === null) {
    countriesError.value = true
    return
  }
  countries.value = res
}

async function loadTags() {
  tagsError.value = false
  const res = await radioService.getTags(100)
  if (res === null) {
    tagsError.value = true
    return
  }
  tags.value = res
}

async function loadStations() {
  isLoading.value = true
  isStale.value = false
  fallbackNotice.value = null
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
      result = await radioService.getTopStations(
        limit,
        offset,
        topOrder.value,
        topCountry.value || undefined,
        topTags.value,
      )

      // Fallback 1: если есть теги и пусто — без тегов
      if (result.stations.length === 0 && topTags.value.length > 0) {
        result = await radioService.getTopStations(
          limit,
          offset,
          topOrder.value,
          topCountry.value || undefined,
          [],
        )
        if (result.stations.length > 0) {
          fallbackNotice.value =
            'По выбранным тегам ничего не найдено, показаны станции без учёта тегов'
        }
      }

      // Fallback 2: если всё ещё пусто и есть страна — без страны
      if (result.stations.length === 0 && topCountry.value) {
        result = await radioService.getTopStations(limit, offset, topOrder.value, undefined, [])
        if (result.stations.length > 0) {
          fallbackNotice.value =
            'По выбранной стране ничего не найдено, показаны все станции'
        }
      }
    }

    stations.value = result.stations
    hasMore.value = result.total >= limit * 3
    isStale.value = radioService.isStale
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
  }, 300)
})

watch(
  [topOrder, topCountry, topTags, topLimit],
  () => {
    localStorage.setItem('radio:topOrder', topOrder.value)
    localStorage.setItem('radio:topCountry', topCountry.value)
    localStorage.setItem('radio:topTags', JSON.stringify(topTags.value))
    localStorage.setItem('radio:topLimit', String(topLimit.value))
    currentPage.value = 1
    void loadStations()
  },
  { deep: true },
)

watch(currentPage, () => {
  void loadStations()
})

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

function isCurrent(stationId: string): boolean {
  return props.currentTrackId === `radio:${stationId}`
}

function isStationPlaying(stationId: string): boolean {
  return isCurrent(stationId) && props.isPlaying
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3 border-b border-hover-bg bg-bg z-30">
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <div class="flex items-center justify-between">
          <h1 class="text-lg font-medium text-fg">Выбор станций</h1>
          <button type="button"
            class="flex items-center gap-1 rounded-btn text-xs font-medium text-fg-muted transition hover:text-fg"
            @click="emit('back')">
            <IconArrowLeft class="h-4 w-4" />
            К выбранным станциям
          </button>
        </div>

        <div class="flex items-center gap-2">
          <SearchInput v-model="searchQuery" always-open placeholder="Поиск по названию..." />
          <button v-if="isSearchMode" type="button"
            class="rounded-btn bg-card-bg px-3 py-2 text-xs text-fg transition hover:bg-hover-bg" @click="clearSearch">
            Сбросить
          </button>
        </div>
      </div>
    </div>

    <!-- Панель фильтров -->
    <div class="shrink-0 bg-bg border-b border-hover-bg z-20">
      <div class="mx-auto w-full max-w-3xl">
        <button type="button"
          class="flex w-full items-center justify-between px-4 py-3 text-xs font-medium text-fg-muted transition hover:text-fg md:hidden"
          @click="isMobileFiltersOpen = !isMobileFiltersOpen">
          <span>
            Фильтры
            <span v-if="hasFilters" class="ml-1 text-active"> · активно</span>
          </span>
          <IconChevronDown class="h-4 w-4 transition-transform" :class="isMobileFiltersOpen ? 'rotate-180' : ''" />
        </button>

        <div class="px-4 pb-3 md:block md:pb-0 md:pt-0" :class="isMobileFiltersOpen ? 'block' : 'hidden'">
          <div class="py-3">
            <RadioFilters v-model:top-order="topOrder" v-model:top-country="topCountry" v-model:top-tags="topTags"
              :countries="countries" :tags="tags" :countries-error="countriesError" :tags-error="tagsError"
              @retry-countries="loadCountries" @retry-tags="loadTags" />
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl py-2 flex flex-col h-full">
        <!-- Баннеры -->
        <div v-if="isStale" class="mx-1 mb-2 rounded-btn bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          Сервер недоступен. Показаны сохранённые данные, они могли устареть.
        </div>
        <div v-if="fallbackNotice" class="mx-1 mb-2 rounded-btn bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          {{ fallbackNotice }}
        </div>

        <div class="flex items-center justify-between px-1 mb-2 shrink-0">
          <SectionTitle :text="listTitle" />

          <div class="flex items-center gap-2 shrink-0">
            <DropdownMenu :width="80" align="right">
              <template #trigger="{ toggle, setTriggerRef }">
                <button :ref="setTriggerRef" type="button"
                  class="flex items-center gap-1 rounded-btn bg-card-bg px-2 py-1.5 text-[10px] text-fg transition hover:bg-hover-bg"
                  @click.stop="toggle">
                  {{ topLimit }}
                  <IconChevronDown class="h-3 w-3" />
                </button>
              </template>
              <template #default="{ close }">
                <button v-for="num in [5, 10, 15, 20, 30]" :key="num" type="button"
                  class="block w-full px-3 py-2 text-left text-xs transition hover:bg-hover-bg"
                  :class="topLimit === num ? 'text-active font-medium' : 'text-fg'" @click="
                    () => {
                      topLimit = num
                      close()
                    }
                  ">
                  {{ num }}
                </button>
              </template>
            </DropdownMenu>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto min-h-0 pr-1">
          <div v-if="isLoading && stations.length === 0" class="flex justify-center py-10">
            <IconSpinner class="h-6 w-6 animate-spin text-fg-muted" />
          </div>
          <div v-else class="flex flex-col gap-0.5 pb-4">
            <div v-for="station in stations" :key="station.id"
              class="flex items-center justify-between gap-3 rounded-btn px-3 py-2 transition"
              :class="isCurrent(station.id) ? 'bg-active/10' : 'hover:bg-hover-bg'">
              <button type="button" class="flex items-center gap-3 min-w-0 flex-1 text-left"
                @click="onPlayClick(station)">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-card-bg">
                  <img v-if="station.favicon" :src="station.favicon" class="h-full w-full object-cover"
                    @error="($event.target as HTMLImageElement).style.display = 'none'" />
                  <IconRadio v-else class="h-5 w-5 text-fg-muted" />
                </div>
                <div class="min-w-0">
                  <span class="text-sm text-fg truncate block">{{ station.name }}</span>
                  <span v-if="station.country" class="text-[10px] text-fg-muted truncate block">
                    {{ station.country }}
                  </span>
                </div>
              </button>
              <div class="flex shrink-0 items-center gap-1">
                <!-- Индикатор «играет» -->
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

                <button v-if="!isSaved(station.id)" type="button"
                  class="rounded-btn p-1.5 text-active transition hover:bg-hover-bg" aria-label="Добавить в мои станции"
                  v-tooltip="'Добавить в мои станции'" @click="onAddClick(station)">
                  <IconPlus class="h-4 w-4" />
                </button>
                <button v-else type="button"
                  class="rounded-btn p-1.5 text-fg-subtle transition hover:bg-hover-bg hover:text-red-400"
                  aria-label="Удалить из моих станций" v-tooltip="'Удалить из моих станций'"
                  @click="onRemoveClick(station)">
                  <IconX class="h-4 w-4" />
                </button>
              </div>
            </div>
            <div v-if="stations.length === 0 && !isLoading" class="text-center py-10 text-sm text-fg-muted">
              Ничего не найдено
            </div>
          </div>
        </div>

        <div v-if="stations.length > 0"
          class="shrink-0 border-t border-hover-bg pt-3 pb-2 flex items-center justify-between mt-auto">
          <button type="button"
            class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="currentPage === 1 || isLoading" @click="currentPage--">
            <IconChevronLeft class="h-4 w-4" /> Назад
          </button>
          <span class="text-xs text-fg-muted">Страница {{ currentPage }}</span>
          <button type="button"
            class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!hasMore || isLoading" @click="currentPage++">
            Вперед
            <IconChevronRight class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
