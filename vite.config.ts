/* eslint-disable @typescript-eslint/no-explicit-any */
// vite.config.ts

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import { federation } from '@module-federation/vite'
import vueJsx from '@vitejs/plugin-vue-jsx'

import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

import pkg from './package.json' with { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const sharedDeps: any = {
  vue: { singleton: true, eager: true },
  pinia: { singleton: true, eager: true },
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_HASH__: JSON.stringify(process.env.GIT_HASH ?? 'dev'),
    'process.env': {},
  },
  plugins: [
    vue(),
    vueJsx(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'CUEI Media Player',
        short_name: 'cuei',
        description: 'Офлайн PWA-плеер для локальной музыкальной библиотеки',
        theme_color: '#091227',
        background_color: '#091227',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        lang: 'ru',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
    federation({
      name: 'cuei-host',
      remotes: {
        logii: {
          type: 'module',
          name: 'logii',
          entry: 'http://localhost:5001/remoteEntry.js',
        },
      },
      shared: sharedDeps,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
  // Vite проксирует /api/* на localhost:3000 (иначе cookie не будут работать в dev-режиме)
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
})
