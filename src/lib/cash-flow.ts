// Flujo de caja: todo lo que entra y sale de la plata del negocio, con un solo saldo.
// Los abonos de clientes y el costo de envío de las cajas llegan solos desde v_cash_flow;
// las reinversiones, gastos, retiros y aportes los anota ella.

import type { CashEntry, CashMovement } from '@/api/cash'
import { PAYMENT_METHODS } from './order-labels'
import { monthOf } from './summary'

/** Movimientos que ella anota a mano (tabla cash_movements). */
export const CASH_KINDS = ['reinversion', 'gasto', 'retiro', 'aporte'] as const
export type CashKind = (typeof CASH_KINDS)[number]

/** Todas las fuentes del flujo: las anotadas más las que llegan solas. */
export const CASH_SOURCES = ['abono', 'aporte', 'reinversion', 'envio', 'gasto', 'retiro'] as const
export type CashSource = (typeof CASH_SOURCES)[number]

export const isCashKind = (value: string | null): value is CashKind =>
  (CASH_KINDS as readonly (string | null)[]).includes(value)

export const isCashSource = (value: string | null): value is CashSource =>
  (CASH_SOURCES as readonly (string | null)[]).includes(value)

/** Entra plata (abonos y aportes) o sale (todo lo demás). */
export const isIncome = (source: CashSource) => source === 'abono' || source === 'aporte'

/** Botón de cada tipo, en primera persona como ella lo diría, y para qué sirve. */
export const cashKindAction: Record<CashKind, { label: string; hint: string }> = {
  reinversion: { label: 'Reinvertí', hint: 'Compras de productos para pedidos o para el inventario.' },
  gasto: { label: 'Pagué un gasto', hint: 'Empaques, domicilios, comisiones y otros gastos del negocio.' },
  retiro: { label: 'Saqué para mí', hint: 'Plata que sacas del negocio para ti.' },
  aporte: { label: 'Metí plata', hint: 'Plata tuya que entra al negocio, incluido el saldo inicial.' },
}

/** Nombre de cada fuente en la lista y en el CSV. */
export const cashSourceLabel: Record<CashSource, string> = {
  abono: 'Abono de cliente',
  aporte: 'Aporte',
  reinversion: 'Reinversión',
  envio: 'Envío de caja',
  gasto: 'Gasto',
  retiro: 'Retiro',
}

/** Medios para anotar un movimiento: los de los abonos más la tarjeta (compras en EE. UU.). */
export const CASH_METHODS = [...PAYMENT_METHODS.filter((method) => method !== 'Otro'), 'Tarjeta', 'Otro'] as const

export type CashDay = { date: string; entries: CashEntry[]; netCop: number }

export type CashFlow = {
  /** Saldo del negocio: hasta hoy, o hasta el cierre del mes si es un mes pasado. */
  balanceCop: number
  /** true si el saldo es el del cierre de un mes pasado. */
  closedMonth: boolean
  inCop: number
  outCop: number
  /** Total del periodo por fuente (siempre positivo). */
  bySource: Record<CashSource, number>
  /** Reinvertido ÷ abonos del periodo; null si no hubo abonos. */
  reinvestedShare: number | null
  /** Movimientos del periodo por día, del más nuevo al más viejo. */
  days: CashDay[]
}

/** month: "2026-10" o null para todos los meses. today: "yyyy-MM-dd" en Bogotá. */
export function buildCashFlow(entries: CashEntry[], month: string | null, today: string): CashFlow {
  const closedMonth = month !== null && month < monthOf(today)
  const inPeriod = entries.filter((entry) => month === null || monthOf(entry.movedOn) === month)
  const upToBalance = closedMonth ? entries.filter((entry) => monthOf(entry.movedOn) <= month) : entries

  const bySource = Object.fromEntries(CASH_SOURCES.map((source) => [source, 0])) as Record<CashSource, number>
  for (const entry of inPeriod) bySource[entry.source] += entry.amountCop

  const inCop = CASH_SOURCES.filter(isIncome).reduce((total, source) => total + bySource[source], 0)
  const outCop = CASH_SOURCES.filter((source) => !isIncome(source)).reduce((total, source) => total + bySource[source], 0)

  const byDate = new Map<string, CashEntry[]>()
  for (const entry of inPeriod) {
    const day = byDate.get(entry.movedOn)
    if (day) day.push(entry)
    else byDate.set(entry.movedOn, [entry])
  }
  const days = [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayEntries]) => ({
      date,
      entries: dayEntries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      netCop: dayEntries.reduce((total, entry) => total + entry.signedCop, 0),
    }))

  return {
    balanceCop: upToBalance.reduce((total, entry) => total + entry.signedCop, 0),
    closedMonth,
    inCop,
    outCop,
    bySource,
    reinvestedShare: bySource.abono > 0 ? bySource.reinversion / bySource.abono : null,
    days,
  }
}

/** Meses con movimientos, más el actual, del más reciente al más antiguo. */
export function cashMonths(entries: CashEntry[], today: string): string[] {
  const months = new Set([monthOf(today), ...entries.map((entry) => monthOf(entry.movedOn))])
  return [...months].sort().reverse()
}

/** ¿Ya anotó algo a mano? Si no, la pantalla le pregunta con cuánta plata arranca. */
export const hasManualEntries = (entries: CashEntry[]) => entries.some((entry) => isCashKind(entry.source))

/** El movimiento anotado a mano detrás de un renglón, para corregirlo; null si llegó solo. */
export function toCashMovement(entry: CashEntry): CashMovement | null {
  if (!isCashKind(entry.source)) return null
  const { id, source: kind, amountCop, movedOn, orderId, method, note } = entry
  return { id, kind, amountCop, movedOn, orderId, method, note }
}

/** Título y detalle de un renglón. Lo anotado a mano se reconoce por su nota; el tipo pasa al detalle. */
export function cashEntryText(entry: CashEntry): { title: string; detail: string } {
  const base: Record<CashSource, string> = {
    abono: `Abono de ${entry.label ?? 'cliente'}`,
    envio: `Envío de la caja ${entry.label ?? ''}`.trim(),
    reinversion: entry.label ? `Compra del pedido de ${entry.label}` : 'Reinversión',
    gasto: 'Gasto',
    retiro: 'Saqué para mí',
    aporte: 'Metí plata',
  }
  const titledByNote = isCashKind(entry.source) && entry.note !== null
  return {
    title: titledByNote ? entry.note! : base[entry.source],
    detail: [titledByNote ? base[entry.source] : entry.note, entry.method].filter(Boolean).join(' · '),
  }
}
