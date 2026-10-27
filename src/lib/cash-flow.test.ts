import { describe, expect, it } from 'vitest'
import type { CashEntry } from '@/api/cash'
import { buildCashFlow, cashMonths, hasManualEntries, isIncome, type CashSource } from './cash-flow'

let nextId = 0
const entry = (source: CashSource, amountCop: number, movedOn: string, createdAt = `${movedOn}T15:00:00Z`): CashEntry => ({
  id: `m${++nextId}`,
  source,
  amountCop,
  signedCop: isIncome(source) ? amountCop : -amountCop,
  movedOn,
  orderId: null,
  shipmentId: null,
  label: null,
  method: null,
  note: null,
  createdAt,
})

const TODAY = '2026-10-27'

describe('buildCashFlow', () => {
  const entries = [
    entry('aporte', 500_000, '2026-09-01'), // saldo inicial
    entry('abono', 200_000, '2026-09-10'),
    entry('reinversion', 300_000, '2026-09-12'),
    entry('abono', 400_000, '2026-10-05'),
    entry('reinversion', 250_000, '2026-10-06'),
    entry('envio', 60_000, '2026-10-06', '2026-10-06T20:00:00Z'),
    entry('gasto', 10_000, '2026-10-07'),
    entry('retiro', 100_000, '2026-10-20'),
  ]

  it('saldo de hoy con todo lo que ha entrado y salido, saldo inicial incluido', () => {
    // 500 + 200 − 300 + 400 − 250 − 60 − 10 − 100 (miles)
    expect(buildCashFlow(entries, '2026-10', TODAY)).toMatchObject({ balanceCop: 380_000, closedMonth: false })
    expect(buildCashFlow(entries, null, TODAY).balanceCop).toBe(380_000)
  })

  it('totales del mes, desglose y porcentaje reinvertido', () => {
    const flow = buildCashFlow(entries, '2026-10', TODAY)
    expect(flow.inCop).toBe(400_000)
    expect(flow.outCop).toBe(420_000)
    expect(flow.bySource).toEqual({
      abono: 400_000,
      aporte: 0,
      reinversion: 250_000,
      envio: 60_000,
      gasto: 10_000,
      retiro: 100_000,
    })
    expect(flow.reinvestedShare).toBe(0.625)
  })

  it('un mes pasado muestra el saldo al cierre de ese mes', () => {
    const flow = buildCashFlow(entries, '2026-09', TODAY)
    expect(flow).toMatchObject({ balanceCop: 400_000, closedMonth: true, inCop: 700_000, outCop: 300_000 })
    expect(flow.reinvestedShare).toBe(1.5)
  })

  it('agrupa por día, del más nuevo al más viejo, y dentro del día por hora de registro', () => {
    const { days } = buildCashFlow(entries, '2026-10', TODAY)
    expect(days.map((day) => day.date)).toEqual(['2026-10-20', '2026-10-07', '2026-10-06', '2026-10-05'])
    expect(days[2].entries.map((e) => e.source)).toEqual(['envio', 'reinversion'])
    expect(days[2].netCop).toBe(-310_000)
  })

  it('el saldo puede quedar negativo (ella puso plata de su bolsillo sin anotarla)', () => {
    const flow = buildCashFlow([entry('reinversion', 90_000, '2026-10-02')], '2026-10', TODAY)
    expect(flow.balanceCop).toBe(-90_000)
  })

  it('sin abonos en el periodo no hay porcentaje reinvertido', () => {
    expect(buildCashFlow([entry('reinversion', 90_000, '2026-10-02')], '2026-10', TODAY).reinvestedShare).toBeNull()
    expect(buildCashFlow([], '2026-10', TODAY)).toMatchObject({ balanceCop: 0, inCop: 0, outCop: 0, days: [] })
  })
})

describe('cashMonths', () => {
  it('meses con movimientos más el actual, del más reciente al más antiguo', () => {
    expect(cashMonths([entry('abono', 1, '2026-08-03'), entry('gasto', 1, '2026-08-20')], TODAY)).toEqual([
      '2026-10',
      '2026-08',
    ])
  })
})

describe('hasManualEntries', () => {
  it('solo cuenta lo anotado a mano, no los abonos ni las cajas', () => {
    expect(hasManualEntries([entry('abono', 1, TODAY), entry('envio', 1, TODAY)])).toBe(false)
    expect(hasManualEntries([entry('abono', 1, TODAY), entry('gasto', 1, TODAY)])).toBe(true)
  })
})
