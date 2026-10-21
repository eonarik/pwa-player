<!-- src/views/settings/SettingsGeneral.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import { toastService } from '@/services/ui/ToastService'
import SectionTitle from '@/components/ui/SectionTitle.vue'

const uiSettings = useUiSettingsStore()
const { showSource, metadataThreshold, searchThreshold, playlistMatchThreshold } =
  storeToRefs(uiSettings)

const spaceName = computed(() => downloadSpaceService.spaceName.value)
const needsPermission = computed(() => downloadSpaceService.needsPermission.value)
const hasSpace = computed(() => downloadSpaceService.hasSpace.value)

const localSearchThreshold = ref(searchThreshold.value)
const localMetadataThreshold = ref(metadataThreshold.value)
const localPlaylistThreshold = ref(playlistMatchThreshold.value)

function applySearchThreshold(): void {
  const v = Number(localSearchThreshold.value)
  if (!Number.isFinite(v) || v < 0 || v > 1) {
    localSearchThreshold.value = searchThreshold.value
    return
  }
  uiSettings.setSearchThreshold(v)
  localSearchThreshold.value = v
}

function applyMetadataThreshold(): void {
  const v = Number(localMetadataThreshold.value)
  if (!Number.isFinite(v) || v < 0 || v > 1) {
    localMetadataThreshold.value = metadataThreshold.value
    return
  }
  uiSettings.setMetadataThreshold(v)
  localMetadataThreshold.value = v
}

function applyPlaylistThreshold(): void {
  const v = Number(localPlaylistThreshold.value)
  if (!Number.isFinite(v) || v < 0 || v > 1) {
    localPlaylistThreshold.value = playlistMatchThreshold.value
    return
  }
  uiSettings.setPlaylistMatchThreshold(v)
  localPlaylistThreshold.value = v
}

const isPickingSpace = ref(false)

async function pickSpace(): Promise<void> {
  if (isPickingSpace.value) return
  isPickingSpace.value = true
  try {
    const handle = await downloadSpaceService.pickSpace()
    if (handle) toastService.success('Папка скачивания выбрана')
  } finally {
    isPickingSpace.value = false
  }
}

async function restoreAccess(): Promise<void> {
  const state = await downloadSpaceService.requestAccess()
  if (state === 'granted') toastService.success('Доступ восстановлен')
  else toastService.error('Доступ отклонён')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <section>
      <SectionTitle text="Поиск" />
      <div class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3">
        <div class="min-w-0">
          <p class="text-sm text-fg">Порог совпадения</p>
          <p class="text-xs text-fg-muted">Чем выше, тем строже поиск</p>
        </div>
        <input v-model.number="localSearchThreshold" type="number" min="0" max="1" step="0.05"
          class="w-20 rounded-btn bg-bg-elevated px-2 py-1 text-right text-sm text-fg focus:outline-none"
          @blur="applySearchThreshold" @keydown.enter="applySearchThreshold" />
      </div>
    </section>

    <section>
      <SectionTitle text="Метаданные" />
      <div class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3">
        <div class="min-w-0">
          <p class="text-sm text-fg">Порог совпадения</p>
          <p class="text-xs text-fg-muted">Ниже порога — трек в «Проблемные»</p>
        </div>
        <input v-model.number="localMetadataThreshold" type="number" min="0" max="1" step="0.05"
          class="w-20 rounded-btn bg-bg-elevated px-2 py-1 text-right text-sm text-fg focus:outline-none"
          @blur="applyMetadataThreshold" @keydown.enter="applyMetadataThreshold" />
      </div>
    </section>

    <section>
      <SectionTitle text="Импорт плейлистов" />
      <div class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3">
        <div class="min-w-0">
          <p class="text-sm text-fg">Порог совпадения</p>
          <p class="text-xs text-fg-muted">Насколько строго искать треки при импорте</p>
        </div>
        <input v-model.number="localPlaylistThreshold" type="number" min="0" max="1" step="0.05"
          class="w-20 rounded-btn bg-bg-elevated px-2 py-1 text-right text-sm text-fg focus:outline-none"
          @blur="applyPlaylistThreshold" @keydown.enter="applyPlaylistThreshold" />
      </div>
    </section>

    <section>
      <SectionTitle text="Отображение" />
      <label class="flex cursor-pointer items-center justify-between gap-4 bg-card-bg px-4 py-3">
        <div class="min-w-0">
          <p class="text-sm text-fg">Показывать источник</p>
          <p class="text-xs text-fg-muted">Путь к папке в списках треков</p>
        </div>
        <input v-model="showSource" type="checkbox" class="h-4 w-4 cursor-pointer accent-active" />
      </label>
    </section>

    <section>
      <SectionTitle text="Папка скачивания" />
      <div class="flex flex-col gap-2 bg-card-bg px-4 py-3">
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <p class="text-sm text-fg">
              <template v-if="hasSpace">{{ spaceName ?? 'Папка выбрана' }}</template>
              <template v-else>Папка не выбрана</template>
            </p>
            <p v-if="needsPermission" class="text-xs text-amber-400">
              Требуется подтвердить доступ
            </p>
            <p v-else-if="hasSpace" class="text-xs text-fg-muted">Доступ есть</p>
            <p v-else class="text-xs text-fg-muted">Для скачивания треков</p>
          </div>
          <button v-if="needsPermission" type="button"
            class="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover"
            @click="restoreAccess">
            Восстановить
          </button>
          <button v-else type="button"
            class="rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg disabled:opacity-50"
            :disabled="isPickingSpace" @click="pickSpace">
            {{ isPickingSpace ? '…' : hasSpace ? 'Сменить' : 'Выбрать' }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
