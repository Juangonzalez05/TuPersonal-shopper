// CSV para abrir en Excel en español (Colombia): separador ";" porque la coma es el
// separador decimal, BOM UTF-8 para que las tildes se vean bien y saltos de línea CRLF.

export type CsvValue = string | number | boolean | null | undefined

const SEPARATOR = ';'
const BOM = '﻿'

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value)
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  return BOM + [header, ...rows].map((row) => row.map(cell).join(SEPARATOR)).join('\r\n') + '\r\n'
}

/** Número con coma decimal y sin separador de miles, como lo lee Excel en español: 4123.45 → "4123,45". */
export const csvDecimal = (value: number | null) => (value === null ? null : String(value).replace('.', ','))

/** Fracción a porcentaje que Excel reconoce: 0.4 → "40%". */
export const csvPercent = (fraction: number | null) =>
  fraction === null ? null : `${csvDecimal(Math.round(fraction * 10_000) / 100)}%`

/** Descarga el texto como archivo .csv desde el navegador. */
export function downloadCsv(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
