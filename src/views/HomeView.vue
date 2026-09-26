<!-- src/views/HomeView.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fileSystemService } from '@/services/filesystem/FileSystemService'
import { yandexDiskService, AuthRequiredError } from '@/services/yandex/YandexDiskService'
import { authService } from '@/services/auth/AuthService'
import { yandexLibraryPersistenceService } from '@/services/persistence/YandexLibraryPersistenceService'
import { saveLastSource } from '@/services/persistence/lastSource'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import LoginModal from '@/components/auth/LoginModal.vue'

const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()
const { needsPermission, isRestoring, hasLibrary, rootFolderName, source } = storeToRefs(library)

const isYandexLoading = ref(false)
const yandexError = ref<string | null>(null)
const isMenuOpen = ref(false)

const showLogin = ref(false)
const loginMandatory = ref(false)
const yandexConfig = ref<{ hasSettings: boolean; publicFolders: string[] } | null>(null)

const sourceLabel = computed(() => {
  if (source.value === 'yandex') return 'Яндекс.Диск'
  if (source.value === 'local') return rootFolderName.value ?? 'Локальная папка'
  return null
})

const sourceIcon = computed(() => (source.value === 'yandex' ? '☁' : '📁'))

const openButtonLabel = computed(() => {
  if (source.value === 'yandex') return 'Открыть Яндекс.Диск'
  return 'Открыть библиотеку'
})

// --- Локальная папка ---------------------------------------------------

async function pickFolder() {
  const handle = await fileSystemService.pickDirectory()
  if (!handle) return

  library.clear()
  player.setQueue([], 0)
  await library.loadFromHandle(handle)
  router.replace({ name: 'folder', params: { path: [] } })
}

// --- Яндекс.Диск -------------------------------------------------------

async function connectYandexDisk() {
  yandexError.value = null

  const alive = await yandexDiskService.ping()
  if (!alive) {
    yandexError.value =
      'Прокси-сервер недоступен. Запустите `cd server && yarn dev` и попробуйте снова.'
    return
  }

  let config
  try {
    config = await yandexDiskService.getConfig()
  } catch (err) {
    yandexError.value = 'Не удалось получить конфиг сервера'
    return
  }

  yandexConfig.value = config

  // Нет .settings.json на диске — доступа нет
  if (!config.hasSettings) {
    yandexError.value = 'Сервер не настроен. Обратитесь к администратору.'
    return
  }

  // Уже авторизован — грузим сразу
  if (authService.isAuthenticated()) {
    const valid = await authService.check()
    if (valid) {
      await loadYandexDisk()
      return
    }
  }

  // Не авторизован — показываем модалку
  loginMandatory.value = config.publicFolders.length === 0
  showLogin.value = true
}

/** Загрузка библиотеки Диска */
async function loadYandexDisk() {
  library.clear()
  player.setQueue([], 0)

  isYandexLoading.value = true
  try {
    await library.loadFromYandexDisk('/', { forceRefresh: false })
    router.replace({ name: 'folder', params: { path: [] } })
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      // Сессия истекла — показываем логин снова
      loginMandatory.value = true
      showLogin.value = true
      return
    }
    yandexError.value = err instanceof Error ? err.message : 'Ошибка загрузки'
  } finally {
    isYandexLoading.value = false
  }
}

/** Юзер успешно вошёл */
function onLoginSuccess() {
  showLogin.value = false
  loadYandexDisk()
}

/** Юзер закрыл модалку без пароля */
function onLoginCancel() {
  showLogin.value = false

  const config = yandexConfig.value
  if (!config) return

  if (config.publicFolders.length === 0) {
    // Нет публичных — снова модалка, обязательная
    loginMandatory.value = true
    showLogin.value = true
    return
  }

  // Есть публичные — грузим с корня. Приватные будут недоступны.
  loadYandexDisk()
}

// --- Общее -------------------------------------------------------------

async function forgetYandexCache() {
  const confirmed = window.confirm(
    'Удалить кэш Яндекс.Диска? При следующем подключении будет полное сканирование.',
  )
  if (!confirmed) return

  await yandexLibraryPersistenceService.clear()
  authService.logout()
  library.clear()
  player.setQueue([], 0)
  void saveLastSource(null)
  isMenuOpen.value = false
  router.replace({ name: 'home' })
}

function logout() {
  authService.logout()
  library.clear()
  player.setQueue([], 0)
  void saveLastSource(null)
  isMenuOpen.value = false
  router.replace({ name: 'home' })
}

async function restoreAccess() {
  const ok = await library.retryRestoreAfterPermission()
  if (ok) router.replace({ name: 'folder', params: { path: [] } })
}

function openLibrary() {
  router.replace({ name: 'folder', params: { path: [] } })
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-6 px-6 text-zinc-400">
    <template v-if="isRestoring">
      <p class="text-sm">Восстановление библиотеки…</p>
    </template>

    <template v-else-if="needsPermission">
      <p class="text-sm">Нет доступа к сохранённой папке</p>
      <button
        type="button"
        class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-emerald-400"
        @click="restoreAccess"
      >
        Восстановить доступ
      </button>
    </template>

    <template v-else-if="isYandexLoading">
      <div class="flex w-64 flex-col items-center gap-3">
        <p class="text-sm text-zinc-300">Сканирование Яндекс.Диска…</p>
        <div class="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            class="h-full w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite] bg-emerald-500"
          />
        </div>
        <p class="text-xs text-zinc-500">
          {{ library.loadProgress.folders }} папок · {{ library.loadProgress.tracks }} треков
        </p>
      </div>
    </template>

    <template v-else-if="hasLibrary">
      <div class="flex flex-col items-center gap-2">
        <div class="text-3xl">{{ sourceIcon }}</div>
        <p class="text-xs uppercase tracking-wider text-zinc-600">Текущая библиотека</p>
        <p class="text-lg font-medium text-zinc-100">{{ sourceLabel }}</p>
      </div>

      <button
        type="button"
        class="rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-emerald-400"
        @click="openLibrary"
      >
        {{ openButtonLabel }}
      </button>

      <div class="relative">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
          @click="isMenuOpen = !isMenuOpen"
        >
          Сменить источник
          <span class="ml-1 text-zinc-600">{{ isMenuOpen ? '▴' : '▾' }}</span>
        </button>

        <div
          v-if="isMenuOpen"
          class="absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-lg"
        >
          <button
            type="button"
            class="block w-full px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
            @click="pickFolder"
          >
            Выбрать локальную папку
          </button>

          <button
            v-if="source !== 'yandex'"
            type="button"
            class="block w-full px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
            @click="connectYandexDisk"
          >
            Подключить Яндекс.Диск
          </button>

          <template v-if="source === 'yandex'">
            <button
              v-if="authService.isAuthenticated()"
              type="button"
              class="block w-full px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
              @click="logout"
            >
              Выйти из аккаунта
            </button>
            <button
              v-else
              type="button"
              class="block w-full px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
              @click="((showLogin = true), (loginMandatory = false))"
            >
              Войти для доступа к приватным папкам
            </button>
          </template>

          <div class="border-t border-zinc-800" />

          <button
            type="button"
            class="block w-full px-4 py-2.5 text-left text-xs text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-400"
            @click="forgetYandexCache"
          >
            Сбросить кэш Диска
          </button>
        </div>
      </div>

      <p v-if="yandexError" class="max-w-md text-center text-xs text-red-400">
        {{ yandexError }}
      </p>
    </template>

    <template v-else>
      <div class="max-w-md text-center">
        <p class="text-lg font-medium text-zinc-100">CUEI Media Player</p>
        <p class="mt-1 text-sm">Локальный офлайн-плеер с поддержкой облачных источников</p>
      </div>

      <div class="flex flex-col items-center gap-3">
        <button
          type="button"
          class="rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-emerald-400"
          @click="pickFolder"
        >
          Выбрать папку на компьютере
        </button>

        <p class="text-xs text-zinc-600">или</p>

        <button
          type="button"
          class="rounded-lg border border-zinc-700 px-6 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
          @click="connectYandexDisk"
        >
          Подключить Яндекс.Диск
        </button>
      </div>

      <p v-if="yandexError" class="max-w-md text-center text-xs text-red-400">
        {{ yandexError }}
      </p>
    </template>

    <!-- Модалка логина -->
    <LoginModal
      v-if="showLogin"
      :mandatory="loginMandatory"
      @success="onLoginSuccess"
      @cancel="onLoginCancel"
    />
  </div>
</template>
