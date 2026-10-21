<!-- src/plugins/radio/RadioView.vue -->
<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { PLUGIN_ID } from './constants'
import {
  radioService,
  type RadioStation,
  type RadioSortOrder,
  type RadioTag,
} from './RadioService'
import { getSavedStations, addSavedStation, type SavedStation } from './index'
import SearchInput from '@/components/ui/SearchInput.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import IconPlay from '@/components/icons/IconPlay.vue'
import IconSpinner from '@/components/icons/IconSpinner.vue'
import IconRadio from '@/components/icons/IconRadio.vue'
import IconPlus from '@/components/icons/IconPlus.vue'
import IconX from '@/components/icons/IconX.vue'
import IconChevronDown from '@/components/icons/IconChevronDown.vue'
import IconChevronLeft from '@/components/icons/IconChevronLeft.vue'
import IconChevronRight from '@/components/icons/IconChevronRight.vue'
import IconArrowLeft from '@/components/icons/IconArrowLeft.vue'
import type { Track } from '@/types/track'

const player = usePlayerStore()

const ORDER_LABELS: Record<RadioSortOrder, string> = {
  clickCount: 'Топ чарт',
  votes: 'По голосам',
  clickTrend: 'В тренде',
  bitrate: 'По качеству',
  random: 'Случайные',
  name: 'По алфавиту',
}

// --- Режим страницы ---
type ViewMode = 'saved' | 'catalog'
const viewMode = ref<ViewMode>('saved')

// --- Общее состояние ---
const savedStations = ref<SavedStation[]>(getSavedStations())

// --- Каталог (поиск и фильтры) ---
const searchQuery = ref('')
const searchResults = ref<RadioStation[]>([])
const isSearching = ref(false)
const error = ref('')

const topLimit = ref(Number(localStorage.getItem('radio:topLimit')) || 15)
const topOrder = ref<RadioSortOrder>(
  (localStorage.getItem('radio:topOrder') as RadioSortOrder) || 'clickCount',
)
const topCountry = ref(localStorage.getItem('radio:topCountry') || '')
const topTags = ref<string[]>(JSON.parse(localStorage.getItem('radio:topTags') || '[]'))

const currentPage = ref(1)
const hasMore = ref(true)

const countries = ref<{ name: string; code: string; stationCount: number }[]>([])
const tags = ref<RadioTag[]>([])
const countriesError = ref(false)
const tagsError = ref(false)

const countryFilter = ref('')
const tagFilter = ref('')

const filteredCountries = computed(() => {
  const q = countryFilter.value.trim().toLowerCase()
  if (!q) return countries.value
  return countries.value.filter((c) => c.name.toLowerCase().includes(q))
})

const filteredTags = computed(() => {
  const q = tagFilter.value.trim().toLowerCase()
  if (!q) return tags.value
  return tags.value.filter((t) => t.name.toLowerCase().includes(q))
})

const isTopLoading = ref(false)
const topStations = ref<RadioStation[]>([])

const topTitle = computed(() => {
  const hasTags = topTags.value.length > 0
  const hasCountry = !!topCountry.value
  if (!hasTags && !hasCountry) return 'Все станции'

  let text = 'Отфильтровано'
  if (hasTags) text += ` по тегам: ${topTags.value.join(', ')}`
  if (hasCountry) {
    const cName = countries.value.find((c) => c.code === topCountry.value)?.name || topCountry.value
    text += hasTags ? ` в ${cName}` : ` по стране: ${cName}`
  }
  return text
})

// --- Загрузка данных ---

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

async function loadTopStations() {
  isTopLoading.value = true
  try {
    const offset = (currentPage.value - 1) * topLimit.value
    const result = await radioService.getTopStations(
      topLimit.value,
      offset,
      topOrder.value,
      topCountry.value || undefined,
      topTags.value,
    )

    topStations.value = result.stations
    hasMore.value = result.total >= topLimit.value * 3
  } finally {
    isTopLoading.value = false
  }
}

// Сброс при смене фильтров
watch(
  [topOrder, topCountry, topTags, topLimit],
  () => {
    localStorage.setItem('radio:topOrder', topOrder.value)
    localStorage.setItem('radio:topCountry', topCountry.value)
    localStorage.setItem('radio:topTags', JSON.stringify(topTags.value))
    localStorage.setItem('radio:topLimit', String(topLimit.value))
    currentPage.value = 1
    if (viewMode.value === 'catalog') {
      void loadTopStations()
    }
  },
  { deep: true },
)

watch(currentPage, () => {
  if (viewMode.value === 'catalog') {
    void loadTopStations()
  }
})

onMounted(async () => {
  savedStations.value = getSavedStations()
  await Promise.all([loadCountries(), loadTags()])
})

// Переключение режимов
function openCatalog() {
  viewMode.value = 'catalog'
  if (topStations.value.length === 0) {
    void loadTopStations()
  }
}

function closeCatalog() {
  viewMode.value = 'saved'
  searchQuery.value = ''
  searchResults.value = []
  error.value = ''
}

// --- Действия ---

async function search() {
  if (!searchQuery.value.trim()) return
  isSearching.value = true
  error.value = ''

  try {
    searchResults.value = await radioService.searchByName(searchQuery.value.trim(), 10)
    if (searchResults.value.length === 0) {
      error.value = 'Станции не найдены'
    }
  } catch {
    error.value = 'Ошибка поиска'
  } finally {
    isSearching.value = false
  }
}

function addAndPlay(station: RadioStation) {
  const saved: SavedStation = {
    id: station.id,
    name: station.name,
    url: station.url,
    favicon: station.favicon,
  }

  addSavedStation(saved)
  savedStations.value = getSavedStations()

  searchResults.value = []
  searchQuery.value = ''
  error.value = ''

  playStation(saved)
}

function removeStation(station: SavedStation, e: Event) {
  e.stopPropagation()
  const confirmed = window.confirm(`Удалить станцию «${station.name}»?`)
  if (!confirmed) return

  const stations = getSavedStations().filter((s) => s.id !== station.id)
  localStorage.setItem('radio:saved-stations', JSON.stringify(stations))
  savedStations.value = getSavedStations()

  if (player.currentTrack?.id === `radio:${station.id}`) {
    player.stop()
  }
}

function playStation(station: SavedStation) {
  if (player.currentTrack?.id === `radio:${station.id}`) {
    player.toggle()
    return
  }

  const track: Track = {
    id: `radio:${station.id}`,
    pluginId: PLUGIN_ID,
    title: station.name,
    artist: '',
    album: '',
    duration: 0,
    filename: '',
    source: station.url,
    coverUrl: station.favicon || undefined,
  }

  player.setQueue([track], 0)
}

function isPlaying(station: SavedStation): boolean {
  return player.currentTrack?.id === `radio:${station.id}` && player.isPlaying
}

function isCurrent(station: SavedStation): boolean {
  return player.currentTrack?.id === `radio:${station.id}`
}

function toggleTag(tag: string) {
  const index = topTags.value.indexOf(tag)
  if (index !== -1) {
    topTags.value.splice(index, 1)
  } else {
    topTags.value.push(tag)
  }
}

function isTagSelected(name: string): boolean {
  return topTags.value.includes(name)
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- ========================================== -->
    <!-- РЕЖИМ 1: МОИ СТАНЦИИ -->
    <!-- ========================================== -->
    <template v-if="viewMode === 'saved'">
      <!-- Шапка -->
      <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3 border-b border-hover-bg bg-bg z-10">
        <div class="mx-auto flex w-full max-w-3xl items-center justify-between">
          <h1 class="text-lg font-medium text-fg">Радиостанции</h1>
          <button type="button"
            class="flex items-center gap-2 rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover"
            @click="openCatalog">
            <IconPlus class="h-4 w-4" />
            Добавить станции
          </button>
        </div>
      </div>

      <!-- Список -->
      <div class="flex-1 overflow-y-auto">
        <div class="mx-auto w-full max-w-3xl p-2 pt-4">
          <p class="text-[10px] uppercase tracking-wider text-fg-subtle mb-3 px-1">Мои станции</p>

          <div v-if="savedStations.length === 0"
            class="flex flex-col items-center justify-center py-20 text-sm text-fg-muted">
            <IconRadio class="mb-3 h-10 w-10 text-fg-subtle" />
            <p>Вы пока не добавили ни одной станции.</p>
          </div>

          <div v-else class="flex flex-col gap-0.5">
            <div v-for="station in savedStations" :key="station.id"
              class="group flex items-center gap-3 rounded-btn px-3 py-2 transition hover:bg-hover-bg cursor-pointer"
              :class="isCurrent(station) ? 'bg-active/10' : ''" @click="playStation(station)">
              <div
                class="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-card-bg">
                <img v-if="station.favicon" :src="station.favicon" class="h-full w-full object-cover"
                  @error="($event.target as HTMLImageElement).style.display = 'none'" />
                <IconRadio v-else class="h-5 w-5 text-fg-muted" />
                <div
                  class="absolute inset-0 flex items-center justify-center bg-bg/50 opacity-0 transition group-hover:opacity-100">
                  <IconPlay class="h-5 w-5 text-fg translate-x-[1px]" />
                </div>
              </div>

              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium" :class="isCurrent(station) ? 'text-active' : 'text-fg'">
                  {{ station.name }}
                </p>
              </div>

              <div v-if="isPlaying(station)" class="flex shrink-0 items-center gap-1">
                <span class="h-3 w-0.5 animate-pulse bg-active" />
                <span class="h-4 w-0.5 animate-pulse bg-active [animation-delay:150ms]" />
                <span class="h-2 w-0.5 animate-pulse bg-active [animation-delay:300ms]" />
              </div>

              <button v-else type="button"
                class="rounded-btn p-1.5 text-fg-subtle opacity-0 transition hover:bg-hover-bg hover:text-red-400 group-hover:opacity-100"
                aria-label="Удалить станцию" @click="removeStation(station, $event)">
                <IconX class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ========================================== -->
    <!-- РЕЖИМ 2: КАТАЛОГ (ФИЛЬТРЫ) -->
    <!-- ========================================== -->
    <template v-else-if="viewMode === 'catalog'">
      <!-- Шапка -->
      <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3 border-b border-hover-bg bg-bg z-30">
        <div class="mx-auto flex w-full max-w-3xl flex-col gap-3">
          <div class="flex items-center justify-between">
            <h1 class="text-lg font-medium text-fg">Выбор станций</h1>
            <button type="button"
              class="flex items-center gap-1 rounded-btn text-xs font-medium text-fg-muted transition hover:text-fg"
              @click="closeCatalog">
              <IconArrowLeft class="h-4 w-4" />
              К выбранным станциям
            </button>
          </div>

          <form class="flex items-center gap-2" @submit.prevent="search">
            <SearchInput v-model="searchQuery" always-open placeholder="Поиск по названию..." />
            <button type="submit"
              class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50"
              :disabled="isSearching">
              Найти
            </button>
          </form>
        </div>
      </div>

      <!-- Панель фильтров -->
      <div class="shrink-0 bg-bg border-b border-hover-bg z-20">
        <div class="mx-auto w-full max-w-3xl px-4 py-3">
          <div class="flex flex-col gap-4">
            <!-- Сортировка -->
            <div class="max-w-xs">
              <p class="mb-2 text-[10px] uppercase tracking-wider text-fg-subtle">Сортировка</p>
              <DropdownMenu :width="160" align="left">
                <template #trigger="{ toggle, setTriggerRef }">
                  <button :ref="setTriggerRef" type="button"
                    class="flex w-full items-center justify-between rounded-btn bg-card-bg px-2 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
                    @click.stop="toggle">
                    {{ ORDER_LABELS[topOrder] }}
                    <IconChevronDown class="h-3 w-3" />
                  </button>
                </template>
                <template #default="{ close }">
                  <button v-for="(label, key) in ORDER_LABELS" :key="key" type="button"
                    class="block w-full px-3 py-2 text-left text-xs transition hover:bg-hover-bg"
                    :class="topOrder === key ? 'text-active font-medium' : 'text-fg'" @click="
                      () => {
                        topOrder = key as RadioSortOrder
                        close()
                      }
                    ">
                    {{ label }}
                  </button>
                </template>
              </DropdownMenu>
            </div>

            <!-- Страна и теги -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Страна -->
              <div>
                <p class="mb-2 text-[10px] uppercase tracking-wider text-fg-subtle">Страна</p>
                <div v-if="countriesError" class="flex flex-col items-start gap-2 bg-card-bg p-2 rounded">
                  <span class="text-xs text-red-400">Ошибка загрузки</span>
                  <button type="button" class="text-xs text-active hover:underline" @click="loadCountries">
                    Повторить
                  </button>
                </div>
                <template v-else>
                  <input v-model="countryFilter" type="text" placeholder="Поиск страны..."
                    class="mb-2 w-full rounded bg-card-bg px-2 py-1 text-xs text-fg placeholder:text-fg-subtle focus:outline-none" />
                  <div class="flex max-h-32 flex-col gap-1 overflow-y-auto pr-1">
                    <button type="button" class="text-left text-xs px-2 py-1 rounded transition" :class="topCountry === ''
                      ? 'bg-active/20 text-active font-medium'
                      : 'text-fg hover:bg-hover-bg'
                      " @click="topCountry = ''">
                      Все страны
                    </button>
                    <button v-for="c in filteredCountries" :key="c.code" type="button"
                      class="flex items-center justify-between gap-2 text-left text-xs px-2 py-1 rounded transition"
                      :class="topCountry === c.code
                        ? 'bg-active/20 text-active font-medium'
                        : 'text-fg hover:bg-hover-bg'
                        " @click="topCountry = c.code">
                      <span class="truncate">{{ c.name }}</span>
                      <span class="shrink-0 text-[10px] tabular-nums text-fg-subtle">
                        {{ c.stationCount }}
                      </span>
                    </button>
                  </div>
                </template>
              </div>

              <!-- Теги -->
              <div>
                <p class="mb-2 text-[10px] uppercase tracking-wider text-fg-subtle">Теги</p>
                <div v-if="tagsError" class="flex flex-col items-start gap-2 bg-card-bg p-2 rounded">
                  <span class="text-xs text-red-400">Ошибка загрузки</span>
                  <button type="button" class="text-xs text-active hover:underline" @click="loadTags">
                    Повторить
                  </button>
                </div>
                <template v-else>
                  <input v-model="tagFilter" type="text" placeholder="Поиск тега..."
                    class="mb-2 w-full rounded bg-card-bg px-2 py-1 text-xs text-fg placeholder:text-fg-subtle focus:outline-none" />
                  <div class="flex max-h-32 flex-wrap gap-1 overflow-y-auto pr-1">
                    <button type="button"
                      class="text-left text-[10px] px-2 py-1 rounded border border-hover-bg transition" :class="topTags.length === 0
                        ? 'bg-active/20 border-active/20 text-active font-medium'
                        : 'text-fg-muted hover:bg-hover-bg'
                        " @click="topTags = []">
                      Все
                    </button>
                    <button v-for="t in filteredTags" :key="t.name" type="button"
                      class="text-left text-[10px] px-2 py-1 rounded border border-hover-bg transition" :class="isTagSelected(t.name)
                        ? 'bg-active/20 border-active/20 text-active font-medium'
                        : 'text-fg-muted hover:bg-hover-bg'
                        " @click="toggleTag(t.name)">
                      {{ t.name }}
                      <span class="ml-0.5 tabular-nums opacity-60">{{ t.stationCount }}</span>
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Результаты поиска -->
      <div v-if="isSearching || searchResults.length > 0 || error"
        class="shrink-0 bg-card-bg/50 px-4 py-2 border-b border-hover-bg">
        <div class="mx-auto w-full max-w-3xl">
          <div v-if="isSearching" class="flex justify-center py-2">
            <IconSpinner class="h-5 w-5 animate-spin text-fg-muted" />
          </div>
          <div v-else-if="error" class="text-center text-sm text-red-400 py-2">
            {{ error }}
          </div>
          <div v-else class="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
            <p
              class="text-[10px] uppercase tracking-wider text-fg-subtle mb-1 sticky top-0 bg-card-bg/50 backdrop-blur">
              Результаты поиска
            </p>
            <div v-for="res in searchResults" :key="res.id"
              class="flex items-center justify-between gap-2 p-2 hover:bg-hover-bg rounded-btn cursor-pointer transition"
              @click="addAndPlay(res)">
              <span class="text-sm text-fg truncate">{{ res.name }} ({{ res.country }})</span>
              <IconPlus class="h-4 w-4 text-active shrink-0" />
            </div>
          </div>
        </div>
      </div>

      <!-- Основная область со списком (скроллится) -->
      <div class="flex-1 overflow-y-auto">
        <div class="mx-auto w-full max-w-3xl p-2 flex flex-col h-full">
          <!-- Заголовок списка -->
          <div class="flex items-center justify-between px-1 mb-2 shrink-0">
            <p class="text-[10px] uppercase tracking-wider text-fg-subtle truncate pr-2">
              {{ topTitle }}
            </p>
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

          <!-- Скроллируемый список станций -->
          <div class="flex-1 overflow-y-auto min-h-0 pr-1">
            <div v-if="isTopLoading && topStations.length === 0" class="flex justify-center py-10">
              <IconSpinner class="h-6 w-6 animate-spin text-fg-muted" />
            </div>
            <div v-else class="flex flex-col gap-0.5 pb-4">
              <div v-for="station in topStations" :key="station.id"
                class="flex items-center justify-between gap-3 rounded-btn px-3 py-2 hover:bg-hover-bg cursor-pointer transition"
                @click="addAndPlay(station)">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-card-bg">
                    <img v-if="station.favicon" :src="station.favicon" class="h-full w-full object-cover"
                      @error="($event.target as HTMLImageElement).style.display = 'none'" />
                    <IconRadio v-else class="h-5 w-5 text-fg-muted" />
                  </div>
                  <span class="text-sm text-fg truncate">{{ station.name }}</span>
                </div>
                <IconPlus class="h-4 w-4 text-fg-subtle shrink-0" />
              </div>
              <div v-if="topStations.length === 0 && !isTopLoading" class="text-center py-10 text-sm text-fg-muted">
                Ничего не найдено
              </div>
            </div>
          </div>

          <!-- Пагинация (закреплена внизу) -->
          <div v-if="topStations.length > 0"
            class="shrink-0 border-t border-hover-bg pt-3 pb-2 flex items-center justify-between mt-auto">
            <button type="button"
              class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="currentPage === 1 || isTopLoading" @click="currentPage--">
              <IconChevronLeft class="h-4 w-4" /> Назад
            </button>
            <span class="text-xs text-fg-muted">Страница {{ currentPage }}</span>
            <button type="button"
              class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!hasMore || isTopLoading" @click="currentPage++">
              Вперед
              <IconChevronRight class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
