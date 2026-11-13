// eslint.config.ts

import { globalIgnores } from 'eslint/config';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import pluginVitest from '@vitest/eslint-plugin';
import pluginOxlint from 'eslint-plugin-oxlint';
import skipFormatting from 'eslint-config-prettier/flat';

export default defineConfigWithVueTs(
  // 1. Общие настройки для всех файлов, которые мы хотим чекать
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx,js,mjs}'],
  },

  // 2. Игнорируем то, что не относится к коду приложения
  globalIgnores([
    '**/dist/**',
    '**/storybook-static/**', // Storybook build artifacts
    '**/dist-ssr/**',
    '**/coverage/**',
    '**/.storybook/**', // Storybook
    '**/test-results/**', // Playwright artifacts (traces, screenshots, videos)
    '**/playwright-report/**', // Playwright HTML report
    'vite.config.ts', // Конфиг Vite
    'vitest.config.ts', // Конфиг Vitest
    'vitest.setup.ts', // Сетап Vitest
    'playwright.config.ts', // Конфиг Playwright
    'eslint.config.ts', // Сам конфиг ESLint
    'server/**', // Сервер (Node.js)
    'scripts/**', // Dev-скрипты (ts-node, не часть приложения)
  ]),

  // 3. Настройки для фронтенда (Vue + TS)
  {
    name: 'app/frontend',
    files: ['src/**/*.{vue,ts,mts,tsx}'],
    extends: [...pluginVue.configs['flat/essential'], vueTsConfigs.recommended],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },

  // 4. Границы слоёв UI: atoms -> molecules -> ui (органимы)
  //    Атом не знает про сторы/сервисы/плагины и не импоррует молекулы/органимы.
  //    Молекула не знает про сторы/сервисы/плагины и не импоррует органимы.
  {
    name: 'app/ui-layer-atoms',
    files: ['src/components/atoms/**/*.vue'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/stores/*'], message: 'Атом не может зависеть от сторов.' },
            { group: ['@/services/*'], message: 'Атом не может зависеть от сервисов.' },
            { group: ['@/plugins/*'], message: 'Атом не может зависеть от плагинов.' },
            { group: ['../molecules/*', '../ui/*'], message: 'Атом не может импортировать молекулы и органимы.' },
          ],
        },
      ],
    },
  },
  {
    name: 'app/ui-layer-molecules',
    files: ['src/components/molecules/**/*.vue'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/stores/*'], message: 'Молекула не может зависеть от сторов.' },
            { group: ['@/services/*'], message: 'Молекула не может зависеть от сервисов.' },
            { group: ['@/plugins/*'], message: 'Молекула не может зависеть от плагинов.' },
            { group: ['../ui/*'], message: 'Молекула не может импортировать органимы.' },
          ],
        },
      ],
    },
  },

  // 5. Настройки для тестов
  {
    name: 'app/tests',
    files: ['src/**/*.spec.ts', 'src/**/__tests__/*', 'e2e/**/*.ts'],
    extends: [vueTsConfigs.recommended],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // 6. Правила Vitest
  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*', 'src/**/*.spec.ts'],
  },

  // 7. Отключаем правила, которые уже проверил Oxlint
  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  // 8. Отключаем правила форматирования (Prettier этим занимается)
  skipFormatting,
);
