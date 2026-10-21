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
import IconChevronDown from '@/components/icons/IconChevronDown.vue'
import IconChevronLeft from '@/components/icons/IconChevronLeft.vue'
import IconChevronRight from '@/components/icons/IconChevronRight.vue'
import IconArrowLeft from '@/components/icons/IconArrowLeft.vue'

const props = defineProps<{
  savedStationIds: Set<string>
}>()

const emit = defineEmits<{
  (e: 'add', station: SavedStation): void
  (e: 'back'): void
}>()

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

const countries = ref<RadioCountryEntry[]>([])
const tags = ref<RadioTag[]>([])
const countriesError = ref(false)
const tagsError = ref(false)

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

function isSaved(stationId: string): boolean {
  return props.savedStationIds.has(stationId)
}

function onAdd(station: RadioStation): void {
  emit('add', {
    id: station.id,
    name: station.name,
    url: station.url,
    favicon: station.favicon,
  })
  searchResults.value = []
  searchQuery.value = ''
  error.value = ''
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

watch(
  [topOrder, topCountry, topTags, topLimit],
  () => {
    localStorage.setItem('radio:topOrder', topOrder.value)
    localStorage.setItem('radio:topCountry', topCountry.value)
    localStorage.setItem('radio:topTags', JSON.stringify(topTags.value))
    localStorage.setItem('radio:topLimit', String(topLimit.value))
    currentPage.value = 1
    void loadTopStations()
  },
  { deep: true },
)

watch(currentPage, () => {
  void loadTopStations()
})

onMounted(async () => {
  await Promise.all([loadCountries(), loadTags(), loadTopStations()])
})

async function search() {
  if (!searchQuery.value.trim()) return
  isSearching.value = true
  error.value = ''

  try {
    searchResults.value = await radioService.searchByName(searchQuery.value.trim(), 10, {
      countryCode: topCountry.value || undefined,
      tags: topTags.value,
    })
    if (searchResults.value.length === 0) {
      error.value = 'Станции не найдены'
    }
  } catch {
    error.value = 'Ошибка поиска'
  } finally {
    isSearching.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка -->
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
        <RadioFilters v-model:top-order="topOrder" v-model:top-country="topCountry" v-model:top-tags="topTags"
          :countries="countries" :tags="tags" :countries-error="countriesError" :tags-error="tagsError"
          @retry-countries="loadCountries" @retry-tags="loadTags" />
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
          <p class="text-[10px] uppercase tracking-wider text-fg-subtle mb-1 sticky top-0 bg-card-bg/50 backdrop-blur">
            Результаты поиска
          </p>
          <div v-for="res in searchResults" :key="res.id"
            class="flex items-center justify-between gap-2 p-2 hover:bg-hover-bg rounded-btn cursor-pointer transition"
            @click="onAdd(res)">
            <span class="text-sm text-fg truncate">{{ res.name }} ({{ res.country }})</span>
            <IconPlus v-if="!isSaved(res.id)" class="h-4 w-4 text-active shrink-0" />
            <span v-else class="text-[10px] text-fg-subtle shrink-0">уже добавлена</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Основная область со списком -->
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
              @click="onAdd(station)">
              <div class="flex items-center gap-3 min-w-0">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-card-bg">
                  <img v-if="station.favicon" :src="station.favicon" class="h-full w-full object-cover"
                    @error="($event.target as HTMLImageElement).style.display = 'none'" />
                  <IconRadio v-else class="h-5 w-5 text-fg-muted" />
                </div>
                <span class="text-sm text-fg truncate">{{ station.name }}</span>
              </div>
              <IconPlus v-if="!isSaved(station.id)" class="h-4 w-4 text-fg-subtle shrink-0" />
              <span v-else class="text-[10px] text-fg-subtle shrink-0">уже добавлена</span>
            </div>
            <div v-if="topStations.length === 0 && !isTopLoading" class="text-center py-10 text-sm text-fg-muted">
              Ничего не найдено
            </div>
          </div>
        </div>

        <!-- Пагинация -->
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
  </div>
</template>
