<!-- src/views/settings/SettingsAbout.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { pwaService } from '@/services/pwa/PwaService'
import { toastService } from '@/services/ui/ToastService'
import Button from '@/components/ui/Button.vue'

const appVersion = __APP_VERSION__
const buildHash = __BUILD_HASH__
const shortHash = buildHash.slice(0, 7)

const isChecking = ref(false)

async function checkForUpdates(): Promise<void> {
  if (isChecking.value) return
  isChecking.value = true
  try {
    // Сбрасываем кулдаун, чтобы регистрация точно проверила обновление.
    localStorage.removeItem('pwa:lastUpdateCheck')
    await pwaService.checkForUpdates()

    if (!pwaService.needRefresh.value) {
      toastService.info('У вас последняя версия')
    }
    // Если есть обновление — usePwaUpdate уже покажет тост.
  } finally {
    isChecking.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <section>
      <div class="flex flex-col gap-2 bg-card-bg px-4 py-3">
        <div class="flex items-center justify-between gap-4">
          <span class="text-sm text-fg">Версия</span>
          <span class="text-xs tabular-nums text-fg-muted">{{ appVersion }}</span>
        </div>
        <div class="flex items-center justify-between gap-4">
          <span class="text-sm text-fg">Хэш билда</span>
          <span class="text-xs tabular-nums text-fg-muted">{{ shortHash }}</span>
        </div>
      </div>
    </section>

    <section>
      <Button variant="secondary" class="w-full" :disabled="isChecking" @click="checkForUpdates">
        {{ isChecking ? 'Проверка…' : 'Проверить обновления' }}
      </Button>
    </section>
  </div>
</template>
