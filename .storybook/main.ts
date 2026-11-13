// .storybook/main.ts
import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx|js|jsx|mdx)'],
  addons: [],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  async viteFinal(config) {
    // Отключаем VitePWA для Storybook: SB-ассеты превышают лимит precaching
    const plugins = (config.plugins || []).filter((p: any) => {
      if (!p || typeof p !== 'object') return true;
      if (Array.isArray(p)) return !p.some((sub: any) => sub?.api?.generateSW);
      if (p.api?.generateSW) return false;
      if (p.name && String(p.name).includes('pwa')) return false;
      return true;
    });
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          '@': new URL('../src', import.meta.url).pathname,
        },
      },
      plugins,
    };
  },
};

export default config;
