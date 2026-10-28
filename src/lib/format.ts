// Formatos y lectura de números para Colombia (es-CO): miles con punto, decimales con
// coma, fechas dd/MM/yyyy y zona America/Bogota.

const LOCALE = 'es-CO'
const TIME_ZONE = 'America/Bogota'

const copFormat = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const usdFormat = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'USD' })
const trmFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })
const percentFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })
const isoDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const formatCop = (value: number) => copFormat.format(value)
/** Con signo para ganancias: 29100 → "+$ 29.100", -3000 → "−$ 3.000". */
export const formatSignedCop = (value: number) => `${value < 0 ? '−' : '+'}${copFormat.format(Math.abs(value))}`
export const formatUsd = (value: number) => usdFormat.format(value)
export const formatTrm = (value: number) => trmFormat.format(value)
/** Fracción a texto: 0.4 → "40 %". */
export const formatPercent = (fraction: number) => `${percentFormat.format(fraction * 100)} %`

/** "2026-10-22" → "22/10/2026", sin pasar por Date (evita el desfase de zona horaria). */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

const monthFormat = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** "2026-10" → "octubre de 2026" */
export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return monthFormat.format(new Date(Date.UTC(year, monthNumber - 1, 1)))
}

/** Fecha de hoy en Bogotá como "yyyy-MM-dd". */
export function todayBogota(now = new Date()): string {
  return isoDateFormat.format(now)
}

/**
 * Lee un número como lo escribe una persona en Colombia o en EE. UU.: "7,99", "7.99",
 * "4.123,45", "4123,45". El último separador es decimal si le siguen 1 o 2 dígitos; si no,
 * todos los separadores son de miles ("4.123" → 4123). null si está vacío o no es número.
 */
export function parseDecimal(text: string): number | null {
  const clean = text.replace(/[\s$%]|US/gi, '')
  if (!/^[\d.,]*\d[\d.,]*$/.test(clean)) return null

  const lastSeparator = Math.max(clean.lastIndexOf('.'), clean.lastIndexOf(','))
  const decimals = lastSeparator >= 0 ? clean.slice(lastSeparator + 1) : ''
  const hasDecimals = lastSeparator >= 0 && decimals.length >= 1 && decimals.length <= 2
  const trailingSeparator = lastSeparator === clean.length - 1

  const integerPart = hasDecimals || trailingSeparator ? clean.slice(0, lastSeparator) : clean
  const digits = integerPart.replace(/[.,]/g, '') || '0'
  return Number(hasDecimals ? `${digits}.${decimals}` : digits)
}

/** Pesos enteros: "15.000" → 15000. */
export function parseCop(text: string): number | null {
  const value = parseDecimal(text)
  return value === null ? null : Math.round(value)
}

/** Porcentaje escrito como número a fracción: "40" → 0.4 (máximo 4 decimales, como en la BD). */
export function parsePercent(text: string): number | null {
  const value = parseDecimal(text)
  return value === null ? null : Math.round(value * 100) / 10_000
}

/** Solo los dígitos de un teléfono, como se guarda: "300 123-4567" → "3001234567". */
export const phoneDigits = (text: string) => text.replace(/\D/g, '')

/** Celular colombiano legible: "3001234567" → "300 123 4567". Otros formatos quedan igual. */
export function formatPhone(phone: string): string {
  return /^3\d{9}$/.test(phone) ? `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}` : phone
}

/** Número a texto editable que parseDecimal vuelve a leer igual: 4123.45 → "4123,45". */
export const decimalInputValue = (value: number) => String(value).replace('.', ',')

/** Fracción a texto editable de porcentaje: 0.4 → "40". */
export const percentInputValue = (fraction: number) =>
  decimalInputValue(Math.round(fraction * 10_000) / 100)
