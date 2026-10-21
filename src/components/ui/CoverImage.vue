<!-- src/components/ui/CoverImage.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import IconPlaylist from '@/components/icons/IconPlaylist.vue'

const props = withDefaults(
  defineProps<{
    src: string | null | undefined
    alt?: string
    /** Размер иконки fallback (Tailwind-класс). */
    fallbackIconClass?: string
  }>(),
  {
    alt: '',
    fallbackIconClass: 'h-5 w-5',
  },
)

const emit = defineEmits<{
  (e: 'error'): void
  (e: 'load'): void
}>()

const hasError = ref(false)

watch(
  () => props.src,
  () => {
    hasError.value = false
  },
)

function onError(): void {
  hasError.value = true
  emit('error')
}

function onLoad(): void {
  emit('load')
}

defineExpose({ hasError })
</script>

<template>
  <img v-if="src && !hasError" :src="src" :alt="alt" class="h-full w-full object-cover" loading="lazy" @error="onError"
    @load="onLoad" />
  <div v-else class="flex h-full w-full items-center justify-center">
    <IconPlaylist class="text-fg-subtle" :class="fallbackIconClass" />
  </div>
</template>
