// .storybook/preview.ts
import type { Preview } from '@storybook/vue3';
import { setup } from '@storybook/vue3';
import { createPinia } from 'pinia';

import '../src/assets/main.css';
import { tooltip } from '../src/directives/tooltip';

setup((app) => {
  app.use(createPinia());
  app.directive('tooltip', tooltip);
});

const THEMES = ['default', 'radio', 'neon', 'barbie', 'tiffany'] as const;
type ThemeId = (typeof THEMES)[number];

const THEME_LABELS: Record<ThemeId, string> = {
  default: 'Тёмная',
  radio: 'Ретро-радио',
  neon: 'Киберпанк',
  barbie: 'Барби',
  tiffany: 'Тиффани',
};

/** Декоратор: 5-колоночная сетка тем */
const withThemeGrid: Preview['decorators'] = [
  (story, ctx) => {
    const theme = ctx.globals.theme || 'default';
    return {
      components: { story },
      template: `
        <div class="flex flex-col gap-6 p-6">
          <div class="border-b border-hover-bg pb-4">
            <p class="text-xs text-fg-muted">Текущая тема: <strong class="text-fg">{{ theme }}</strong></p>
          </div>
          <div class="grid grid-cols-5 gap-4">
            <div v-for="t in themes" :key="t" :data-theme="t === 'default' ? null : t">
              <p class="mb-2 text-xs font-medium text-fg-muted">{{ themeLabel(t) }}</p>
              <div class="bg-bg rounded-card p-4 min-h-[200px]">
                <story />
              </div>
            </div>
          </div>
        </div>
      `,
      setup: () => ({
        themes: THEMES,
        theme,
        themeLabel(id: ThemeId) {
          return THEME_LABELS[id];
        },
      }),
    };
  },
];

/** Декоратор: тематический Chrome для компонентов с глобальными селекторами */
const withThemedChrome: Preview['decorators'] = [
  (story, ctx) => {
    const theme = ctx.globals.theme || 'default';
    return {
      components: { story },
      template: `
        <div :data-theme="theme === 'default' ? null : theme">
          <header class="p-3 text-sm font-medium text-fg-muted border-b border-hover-bg">
            {{ themeLabel(theme) }}
          </header>
          <main class="p-4">
            <story />
          </main>
        </div>
      `,
      setup: () => ({
        theme,
        themeLabel(id: ThemeId) {
          return THEME_LABELS[id];
        },
      }),
    };
  },
];

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      autodocs: 'tag',
    },
  },
  decorators: [...(withThemeGrid as any[]), ...(withThemedChrome as any[])],
  globalTypes: {
    theme: {
      description: 'Глобальная тема',
      defaultValue: 'default',
      toolbar: {
        title: 'Тема',
        icon: 'paintbrush',
        items: [
          { value: 'default', title: 'Тёмная' },
          { value: 'radio', title: 'Ретро-радио' },
          { value: 'neon', title: 'Киберпанк' },
          { value: 'barbie', title: 'Барби' },
          { value: 'tiffany', title: 'Тиффани' },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;

