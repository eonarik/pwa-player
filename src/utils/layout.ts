// src/utils/layout.ts

const EN_TO_RU: Record<string, string> = {
  q: 'й',
  w: 'ц',
  e: 'у',
  r: 'к',
  t: 'е',
  y: 'н',
  u: 'г',
  i: 'ш',
  o: 'щ',
  p: 'з',
  '[': 'х',
  ']': 'ъ',
  a: 'ф',
  s: 'ы',
  d: 'в',
  f: 'а',
  g: 'п',
  h: 'р',
  j: 'о',
  k: 'л',
  l: 'д',
  ';': 'ж',
  "'": 'э',
  z: 'я',
  x: 'ч',
  c: 'с',
  v: 'м',
  b: 'и',
  n: 'т',
  m: 'ь',
  ',': 'б',
  '.': 'ю',
  '/': '.',
  Q: 'Й',
  W: 'Ц',
  E: 'У',
  R: 'К',
  T: 'Е',
  Y: 'Н',
  U: 'Г',
  I: 'Ш',
  O: 'Щ',
  P: 'З',
  A: 'Ф',
  S: 'Ы',
  D: 'В',
  F: 'А',
  G: 'П',
  H: 'Р',
  J: 'О',
  K: 'Л',
  L: 'Д',
  Z: 'Я',
  X: 'Ч',
  C: 'С',
  V: 'М',
  B: 'И',
  N: 'Т',
  M: 'Ь',
}

const RU_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_RU).map(([en, ru]) => [ru, en]),
)

const UMLAUTS: Record<string, string> = {
  ä: 'a',
  ö: 'o',
  ü: 'u',
  ß: 'ss',
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  á: 'a',
  à: 'a',
  â: 'a',
  ã: 'a',
  å: 'a',
  í: 'i',
  ì: 'i',
  î: 'i',
  ï: 'i',
  ó: 'o',
  ò: 'o',
  ô: 'o',
  õ: 'o',
  ú: 'u',
  ù: 'u',
  û: 'u',
  ñ: 'n',
  ç: 'c',
  ý: 'y',
  ÿ: 'y',
}

/** Конвертирует текст из QWERTY в ЙЦУКЕН (по позиции клавиш). */
export function toRussianLayout(text: string): string {
  return Array.from(text)
    .map((char) => EN_TO_RU[char] ?? char)
    .join('')
}

/** Конвертирует текст из ЙЦУКЕН в QWERTY. */
export function toEnglishLayout(text: string): string {
  return Array.from(text)
    .map((char) => RU_TO_EN[char] ?? char)
    .join('')
}

/** Убирает умлауты и диакритику (ä → a, é → e, ñ → n). */
export function normalizeUmlauts(text: string): string {
  return Array.from(text)
    .map((char) => UMLAUTS[char.toLowerCase()] ?? char)
    .join('')
}

/**
 * Возвращает все варианты написания строки:
 * - как есть
 * - QWERTY → ЙЦУКЕН
 * - ЙЦУКЕН → QWERTY
 * - без умлаутов
 */
export function layoutVariants(text: string): string[] {
  const normalized = text.toLowerCase()
  const variants = new Set<string>([
    normalized,
    normalizeUmlauts(normalized),
    toRussianLayout(normalized),
    toEnglishLayout(normalized),
  ])
  return Array.from(variants)
}
