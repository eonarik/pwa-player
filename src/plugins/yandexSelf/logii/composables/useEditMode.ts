// src/plugins/yandexSelf/logii/composables/useEditMode.ts

import { ref, watch, type Ref } from 'vue';

const EDIT_MODE_KEY = 'logii:editMode';

export function useEditMode(): { isEditMode: Ref<boolean> } {
  let stored = null;
  try {
    stored = localStorage.getItem(EDIT_MODE_KEY);
  } catch {
    // ignore SecurityError
  }

  const isEditMode = ref(stored === 'true');

  watch(isEditMode, (value) => {
    try {
      localStorage.setItem(EDIT_MODE_KEY, String(value));
    } catch {
      // ignore SecurityError
    }
  });

  return { isEditMode };
}
