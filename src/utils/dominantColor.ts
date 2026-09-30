// src/utils/dominantColor.ts

export interface Rgb {
  r: number
  g: number
  b: number
}

/** Fallback — наш акцентный светлый */
export const FALLBACK_RGB: Rgb = { r: 234, g: 240, b: 255 }

/** Размер сэмпла — маленький, чтобы быстро */
const SAMPLE_SIZE = 64

/** Отсечки для «мусорных» пикселей */
const MIN_SUM = 60 // слишком тёмные
const MAX_SUM = 720 // слишком светлые
const MIN_ALPHA = 128

const cache = new Map<string, Rgb | null>()

/**
 * Извлекает доминирующий цвет из изображения.
 * Возвращает null, если не удалось (CORS, битая картинка, все пиксели отсеяны).
 * Результат кэшируется в памяти по src.
 */
export async function extractDominantColor(src: string): Promise<Rgb | null> {
  if (cache.has(src)) return cache.get(src) ?? null

  try {
    const img = await loadImage(src)
    const color = computeDominant(img)
    cache.set(src, color)
    return color
  } catch (err) {
    // CORS, сеть, битый URL — не шумим, просто кэшируем null
    console.warn('[dominantColor] failed for', src, err)
    cache.set(src, null)
    return null
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

function computeDominant(img: HTMLImageElement): Rgb | null {
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIZE
  canvas.height = SAMPLE_SIZE

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)

  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data
  } catch {
    // SecurityError — тайно CORS
    return null
  }

  let r = 0
  let g = 0
  let b = 0
  let count = 0

  for (let i = 0; i < data.length; i += 4) {
    const pr = data[i]!
    const pg = data[i + 1]!
    const pb = data[i + 2]!
    const pa = data[i + 3]!

    if (pa < MIN_ALPHA) continue

    const sum = pr + pg + pb
    if (sum < MIN_SUM) continue
    if (sum > MAX_SUM) continue

    r += pr
    g += pg
    b += pb
    count++
  }

  if (count === 0) return null

  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  }
}

/** Форматирует RGB в строку для CSS */
export function rgbToString({ r, g, b }: Rgb, alpha = 1): string {
  if (alpha === 1) return `rgb(${r}, ${g}, ${b})`
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
