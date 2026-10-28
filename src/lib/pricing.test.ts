import { describe, expect, it } from 'vitest'
import { impliedMarkup, lineTotals, orderTotals, paymentStatus, type LineInput } from './pricing'

// Casos de ROADMAP §4: los mismos números del Excel.
const caseA: LineInput = { unitCostUsd: 10, trm: 4000, qty: 2, markupPct: 0.4, unitPriceCop: null, shippingChargedCop: 15_000 }
const caseB: LineInput = { unitCostUsd: 7.99, trm: 4123.45, qty: 1, markupPct: 0.4, unitPriceCop: null, shippingChargedCop: 0 }
const caseC: LineInput = { unitCostUsd: 0, trm: 0, qty: 1, markupPct: null, unitPriceCop: null, shippingChargedCop: 12_000 }

describe('casos del roadmap', () => {
  it('A: costo, precio, ganancia, total, saldo y estado', () => {
    expect(lineTotals(caseA)).toMatchObject({
      costCop: 80_000,
      priceCop: 112_000,
      profitCop: 32_000,
      totalCop: 127_000,
      incomplete: false,
    })
    expect(orderTotals([caseA], 50_000)).toMatchObject({
      totalCop: 127_000,
      balanceCop: 77_000,
      paymentStatus: 'separado',
    })
  })

  it('B: redondeo exacto (7,99 × 4123,45 no se pierde en flotantes)', () => {
    expect(lineTotals(caseB)).toMatchObject({
      costCop: 32_946,
      priceCop: 46_100,
      profitCop: 13_154,
      totalCop: 46_100,
      incomplete: false,
    })
    expect(orderTotals([caseB], 0)).toMatchObject({
      totalCop: 46_100,
      balanceCop: 46_100,
      paymentStatus: 'pendiente',
    })
  })

  it('C: producto sin costo, solo envío/gestión', () => {
    expect(lineTotals(caseC)).toMatchObject({
      costCop: 0,
      priceCop: 0,
      profitCop: 0,
      totalCop: 12_000,
      incomplete: false,
    })
    expect(orderTotals([caseC], 12_000)).toMatchObject({
      totalCop: 12_000,
      balanceCop: 0,
      paymentStatus: 'pagado',
    })
  })
})

describe('lineTotals', () => {
  it('redondea el precio a la centena con la mitad hacia arriba, como Postgres', () => {
    const base = { unitCostUsd: 1, qty: 1, markupPct: 0, unitPriceCop: null, shippingChargedCop: 0 }
    expect(lineTotals({ ...base, trm: 50 }).priceCop).toBe(100)
    expect(lineTotals({ ...base, trm: 149 }).priceCop).toBe(100)
    expect(lineTotals({ ...base, trm: 150 }).priceCop).toBe(200)
  })

  it('redondea el costo al peso con la mitad hacia arriba', () => {
    // 0,25 × 2 × 1 = 0,5 → 1 ; 0,25 × 1,98 = 0,495 → 0
    expect(lineTotals({ unitCostUsd: 0.25, trm: 2, qty: 1, markupPct: 0, unitPriceCop: null, shippingChargedCop: 0 }).costCop).toBe(1)
    expect(lineTotals({ unitCostUsd: 0.25, trm: 1.98, qty: 1, markupPct: 0, unitPriceCop: null, shippingChargedCop: 0 }).costCop).toBe(0)
  })

  it('marca incompleta la línea con costo y sin TRM', () => {
    const line = lineTotals({ ...caseA, trm: 0 })
    expect(line.incomplete).toBe(true)
    expect(line.missing).toEqual(['trm'])
  })

  it('marca incompleta la línea con costo y sin precio ni %, y la cobra al costo redondeado', () => {
    const line = lineTotals({ ...caseB, markupPct: null })
    expect(line.incomplete).toBe(true)
    expect(line.missing).toEqual(['price'])
    expect(line.priceCop).toBe(32_900)
  })

  it('no marca incompleta la línea sin costo aunque falten TRM y %', () => {
    expect(lineTotals(caseC).missing).toEqual([])
  })
})

describe('precio c/u al cliente (ya incluye el envío)', () => {
  it('caso A escrito con precio: 63.500 c/u traen los 15.000 de envío y dan los mismos números', () => {
    const line = lineTotals({ ...caseA, markupPct: null, unitPriceCop: 63_500 })
    expect(line).toMatchObject({
      costCop: 80_000,
      priceCop: 112_000,
      profitCop: 32_000,
      shippingChargedCop: 15_000,
      totalCop: 127_000,
      incomplete: false,
    })
    expect(impliedMarkup(line.costCop, line.priceCop)).toBe(0.4)
    expect(orderTotals([{ ...caseA, markupPct: null, unitPriceCop: 63_500 }], 50_000)).toMatchObject({
      itemsPriceCop: 112_000,
      shippingChargedCop: 15_000,
      totalCop: 127_000,
      balanceCop: 77_000,
    })
  })

  it('el envío no se suma encima: 59.000 c/u con 30.000 de envío cobran 59.000', () => {
    const line = lineTotals({
      unitCostUsd: 5.99,
      trm: 3170,
      qty: 1,
      markupPct: null,
      unitPriceCop: 59_000,
      shippingChargedCop: 30_000,
    })
    // El producto vale 59.000 − 30.000; la ganancia del envío se ve por caja.
    expect(line).toMatchObject({ costCop: 18_988, priceCop: 29_000, profitCop: 10_012, totalCop: 59_000 })
  })

  it('el precio escrito manda sobre el % y no se redondea a la centena', () => {
    expect(lineTotals({ ...caseB, unitPriceCop: 46_150 }).priceCop).toBe(46_150)
  })

  it('producto sin costo con precio: lo que no es envío es ganancia y no hay incremento', () => {
    const line = lineTotals({ ...caseC, unitPriceCop: 20_000 })
    expect(line).toMatchObject({ costCop: 0, priceCop: 8_000, profitCop: 8_000, totalCop: 20_000, incomplete: false })
    expect(impliedMarkup(line.costCop, line.priceCop)).toBeNull()
  })

  it('si el envío es mayor que lo que se cobra, el producto queda en pérdida', () => {
    const line = lineTotals({ ...caseA, markupPct: null, unitPriceCop: 30_000, shippingChargedCop: 70_000 })
    expect(line).toMatchObject({ priceCop: -10_000, profitCop: -90_000, totalCop: 60_000 })
  })

  it('el incremento se redondea a 4 decimales, como en la base', () => {
    expect(impliedMarkup(5_072, 5_500)).toBe(0.0844)
  })
})

describe('orderTotals', () => {
  it('suma varias líneas y descuenta los abonos', () => {
    const totals = orderTotals([caseA, caseB, caseC], 60_000)
    expect(totals).toEqual({
      itemsCostCop: 112_946,
      itemsPriceCop: 158_100,
      itemsProfitCop: 45_154,
      shippingChargedCop: 27_000,
      totalCop: 185_100,
      paidCop: 60_000,
      balanceCop: 125_100,
      paymentStatus: 'separado',
      incompleteItems: 0,
    })
  })

  it('cuenta las líneas incompletas', () => {
    expect(orderTotals([caseA, { ...caseB, trm: 0 }], 0).incompleteItems).toBe(1)
  })

  it('un pedido pagado de más queda pagado con saldo negativo', () => {
    expect(orderTotals([caseB], 50_000)).toMatchObject({ balanceCop: -3_900, paymentStatus: 'pagado' })
  })
})

describe('paymentStatus', () => {
  it('pagado si el saldo es 0 o menos, separado si hay abono, si no pendiente', () => {
    expect(paymentStatus(0, 0)).toBe('pagado')
    expect(paymentStatus(-100, 500)).toBe('pagado')
    expect(paymentStatus(1_000, 500)).toBe('separado')
    expect(paymentStatus(1_000, 0)).toBe('pendiente')
  })
})
