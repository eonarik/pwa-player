// src/env.d.ts

/// <reference types="vite/client" />

import type { Buffer as BufferType } from 'buffer'
import type processType from 'process'

declare global {
  interface Window {
    /** Полифил для music-metadata-browser */
    global: typeof globalThis
    /** Полифил для music-metadata-browser */
    Buffer: typeof BufferType
    /** Полифил для music-metadata-browser */
    process: typeof processType
  }
}

export {}
