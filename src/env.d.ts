// src/env.d.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

import type { Buffer as BufferType } from 'buffer'
import type processType from 'process'

declare module '*.css' {
  const content: string
  export default content
}
declare module '*.scss' {
  const content: string
  export default content
}

declare module 'virtual:__federation__' {
  export function __federation_method_setRemote(name: string, config: any): void
  export function __federation_method_getRemote(name: string, module: string): Promise<any>
  export function __federation_method_unwrapDefault(module: any): any
}

declare global {
  const __APP_VERSION__: string
  const __BUILD_HASH__: string

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
