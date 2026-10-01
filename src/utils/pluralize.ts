// src/utils/pluralize.ts

export function pluralize(count: number, forms: [one: string, few: string, many: string]): string {
  const abs = Math.abs(count)
  const mod100 = abs % 100
  const mod10 = abs % 10

  let form: string
  if (mod100 >= 11 && mod100 <= 14) {
    form = forms[2]
  } else if (mod10 === 1) {
    form = forms[0]
  } else if (mod10 >= 2 && mod10 <= 4) {
    form = forms[1]
  } else {
    form = forms[2]
  }

  return `${count} ${form}`
}
