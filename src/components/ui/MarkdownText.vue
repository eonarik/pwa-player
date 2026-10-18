<!-- src/components/ui/MarkdownText.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { getMarkdownRenderer } from '@/services/markdown'

const props = defineProps<{
  source: string
}>()

const html = computed(() => getMarkdownRenderer().render(props.source))
</script>

<template>
  <div v-if="html" class="markdown-text" v-html="html" />
  <span v-else>{{ source }}</span>
</template>

<style scoped>
.markdown-text :deep(strong) {
  color: var(--color-fg);
  font-weight: 500;
}

.markdown-text :deep(em) {
  color: var(--color-fg);
}

.markdown-text :deep(code) {
  padding: 0.1em 0.3em;
  border-radius: 0.2rem;
  background: var(--color-hover-bg);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.9em;
}

.markdown-text :deep(a) {
  color: var(--color-active);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.markdown-text :deep(a:hover) {
  color: var(--color-fg);
}
</style>
