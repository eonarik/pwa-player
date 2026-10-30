<!-- src/components/ui/AutocompleteInput.vue -->

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import Icon from './Icon.vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    suggestions: string[];
    placeholder?: string;
    id?: string;
  }>(),
  { placeholder: '' },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const isOpen = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const wrapperRef = ref<HTMLElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
const activeIndex = ref(-1);
const searchQuery = ref('');

const uniqueSuggestions = computed(() => {
  const items = Array.from(new Set(props.suggestions.filter(Boolean)));
  return items.sort((a, b) => a.localeCompare(b, 'ru'));
});

const filteredSuggestions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return uniqueSuggestions.value;
  return uniqueSuggestions.value.filter((s) => s.toLowerCase().includes(query));
});

const showDropdown = computed(() => isOpen.value && filteredSuggestions.value.length > 0);

function toggleDropdown() {
  if (!isOpen.value) {
    searchQuery.value = '';
    isOpen.value = true;
    activeIndex.value = -1;
  } else {
    isOpen.value = false;
  }
}

function onInput(e: Event) {
  const target = e.target as HTMLInputElement;
  emit('update:modelValue', target.value);
  searchQuery.value = target.value;
  isOpen.value = true;
  activeIndex.value = -1;
}

function onSelect(value: string) {
  emit('update:modelValue', value);
  isOpen.value = false;
  searchQuery.value = '';
  inputRef.value?.focus();
}

function clear() {
  emit('update:modelValue', '');
  searchQuery.value = '';
  isOpen.value = true;
  inputRef.value?.focus();
}

function onKeydown(e: KeyboardEvent) {
  if (!showDropdown.value) {
    if (e.key === 'ArrowDown' && filteredSuggestions.value.length > 0) {
      isOpen.value = true;
    }
    return;
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      activeIndex.value = Math.min(activeIndex.value + 1, filteredSuggestions.value.length - 1);
      scrollToActive();
      break;
    case 'ArrowUp':
      e.preventDefault();
      activeIndex.value = Math.max(activeIndex.value - 1, 0);
      scrollToActive();
      break;
    case 'Enter':
      e.preventDefault();
      if (activeIndex.value >= 0 && activeIndex.value < filteredSuggestions.value.length) {
        onSelect(filteredSuggestions.value[activeIndex.value]!);
      } else if (filteredSuggestions.value.length > 0) {
        onSelect(filteredSuggestions.value[0]!);
      }
      break;
    case 'Escape':
      isOpen.value = false;
      break;
  }
}

function scrollToActive() {
  nextTick(() => {
    const activeEl = listRef.value?.children[activeIndex.value] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  });
}

function onDocumentClick(e: MouseEvent) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick);
});
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentClick);
});
</script>

<template>
  <div ref="wrapperRef" class="relative w-full">
    <div class="relative flex items-center">
      <input
        ref="inputRef"
        :id="id"
        :value="modelValue"
        type="text"
        :placeholder="placeholder"
        class="w-full rounded-btn bg-card-bg py-2 pl-3 pr-16 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none"
        autocomplete="off"
        @input="onInput"
        @focus="isOpen = true"
        @keydown="onKeydown"
      />

      <div class="absolute right-2 flex items-center gap-1">
        <button
          v-if="modelValue"
          type="button"
          class="rounded-btn p-0.5 text-fg-subtle transition hover:text-fg"
          tabindex="-1"
          aria-label="Очистить"
          @click="clear"
        >
          <Icon name="x" w="w-3.5" h="h-3.5" />
        </button>
        <button
          type="button"
          class="rounded-btn p-0.5 text-fg-muted transition hover:text-fg"
          tabindex="-1"
          aria-label="Показать список"
          @click="toggleDropdown"
        >
          <Icon name="chevron-down" w="w-4" h="h-4" class="transition" :class="isOpen ? 'rotate-180' : ''" />
        </button>
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="showDropdown"
        ref="listRef"
        class="absolute left-0 right-0 top-full z-[200] mt-1 max-h-60 overflow-y-auto rounded-btn bg-bg-elevated shadow-lg"
      >
        <button
          v-for="(item, index) in filteredSuggestions"
          :key="item"
          type="button"
          class="block w-full px-3 py-2 text-left text-sm text-fg transition hover:bg-hover-bg"
          :class="{ 'bg-hover-bg': index === activeIndex }"
          @click="onSelect(item)"
          @mouseenter="activeIndex = index"
        >
          {{ item }}
        </button>
      </div>
    </Transition>
  </div>
</template>
