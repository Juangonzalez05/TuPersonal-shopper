import { describe, expect, it } from 'vitest'
import type { OrderSummary } from '@/api/orders'
import type { BoxItem, Shipment } from '@/api/shipments'
import type { StockItem } from '@/api/stock'
import { buildSummary, monthOptions } from './summary'

const order = (o: Partial<OrderSummary> & Pick<OrderSummary, 'id' | 'orderedOn' | 'status'>): OrderSummary => ({
  customerId: 'c',
  customerName: 'Cliente',
  customerPhone: null,
  notes: null,
  itemsPriceCop: 0,
  itemsCostCop: 0,
  itemsProfitCop: 0,
  shippingChargedCop: 0,
  totalCop: 0,
  paidCop: 0,
  balanceCop: 0,
  paymentStatus: 'pendiente',
  incompleteItems: 0,
  ...o,
})

const shipment = (s: Partial<Shipment> & Pick<Shipment, 'id' | 'state'>): Shipment => ({
  code: s.id,
  carrier: null,
  shippedOn: null,
  expectedOn: null,
  arrivedOn: null,
  realCostCop: null,
  notes: null,
  itemsCount: 0,
  chargedCop: 0,
  differenceCop: null,
  stockUnits: 0,
  createdAt: '2026-10-01T15:00:00Z',
  ...s,
})

const unboxed = (id: string, orderedOn: string, shippingChargedCop: number): BoxItem => ({
  id,
  description: id,
  qty: 1,
  shippingChargedCop,
  orderId: 'o',
  orderStatus: 'comprado',
  orderedOn,
  customerName: 'Cliente',
})

const stockItem = (productId: string, availableQty: number, state: StockItem['state']): StockItem => ({
  productId,
  name: productId,
  enteredQty: Math.max(availableQty, 0),
  inTransitQty: 0,
  soldQty: 0,
  availableQty,
  state,
})

// Casos A y B del roadmap en octubre, uno de septiembre, más una cotización y un anulado que no cuentan.
const data = {
  orders: [
    order({ id: 'A', orderedOn: '2026-10-05', status: 'confirmado', itemsPriceCop: 112_000, shippingChargedCop: 15_000, totalCop: 127_000, itemsCostCop: 80_000, itemsProfitCop: 32_000, paidCop: 50_000, balanceCop: 77_000, paymentStatus: 'separado' }),
    order({ id: 'B', orderedOn: '2026-10-10', status: 'entregado', itemsPriceCop: 46_100, totalCop: 46_100, itemsCostCop: 32_946, itemsProfitCop: 13_154, paidCop: 50_000, balanceCop: -3_900, paymentStatus: 'pagado' }),
    order({ id: 'cotizacion', orderedOn: '2026-10-12', status: 'cotizado', itemsPriceCop: 99_900, totalCop: 99_900, itemsCostCop: 70_000, itemsProfitCop: 29_900, balanceCop: 99_900 }),
    order({ id: 'anulado', orderedOn: '2026-10-15', status: 'anulado', itemsPriceCop: 50_000, totalCop: 50_000, itemsCostCop: 40_000, itemsProfitCop: 10_000, balanceCop: 50_000 }),
    order({ id: 'sept', orderedOn: '2026-09-20', status: 'comprado', itemsPriceCop: 20_000, shippingChargedCop: 5_000, totalCop: 25_000, itemsCostCop: 15_000, itemsProfitCop: 5_000, balanceCop: 25_000, incompleteItems: 1 }),
  ],
  shipments: [
    shipment({ id: 'ENV-001', state: 'llego', arrivedOn: '2026-10-18', realCostCop: 10_000, chargedCop: 15_000, differenceCop: 5_000 }),
    // Sin llegada ni despacho: cuenta en el mes en que se creó (en hora de Bogotá). Aún sin costo.
    shipment({ id: 'ENV-002', state: 'en_camino', createdAt: '2026-11-01T03:00:00Z' }),
    shipment({ id: 'ENV-000', state: 'llego', arrivedOn: '2026-09-30', realCostCop: 8_000, chargedCop: 5_000, differenceCop: -3_000 }),
  ],
  unboxed: [unboxed('u-oct', '2026-10-05', 12_000), unboxed('u-sep', '2026-09-20', 5_000)],
  stock: [
    stockItem('a', 3, 'disponible'),
    stockItem('b', 0, 'agotado'),
    stockItem('c', -1, 'revisar'),
    { ...stockItem('d', 5, 'disponible'), inTransitQty: 2 },
  ],
}

describe('buildSummary (fórmulas de la hoja Resumen)', () => {
  it('octubre: solo pedidos confirmados en adelante del mes', () => {
    const summary = buildSummary(data, '2026-10')
    expect(summary.billing).toEqual({
      productsCop: 158_100,
      shippingCop: 15_000,
      totalCop: 173_100,
      paidCop: 100_000,
      // Como el SUM del Excel: el pago de más de B resta.
      balanceCop: 73_100,
    })
    expect(summary.costs).toEqual({ productsCop: 112_946, shippingCostCop: 10_000 })
    expect(summary.profit).toEqual({ productsCop: 45_154, shippingCop: 5_000, totalCop: 50_154 })
    expect(summary.sales).toEqual({ pendiente: 0, separado: 1, pagado: 1, incomplete: 0, quotes: 1 })
    expect(summary.shipments).toEqual({ arrived: 1, inTransit: 1, withoutCost: 1, unboxedShippingCop: 12_000 })
  })

  it('todos los meses suma todo, también la pérdida de una caja', () => {
    const summary = buildSummary(data, null)
    expect(summary.billing).toEqual({
      productsCop: 178_100,
      shippingCop: 20_000,
      totalCop: 198_100,
      paidCop: 100_000,
      balanceCop: 98_100,
    })
    expect(summary.costs).toEqual({ productsCop: 127_946, shippingCostCop: 18_000 })
    expect(summary.profit).toEqual({ productsCop: 50_154, shippingCop: 2_000, totalCop: 52_154 })
    expect(summary.sales).toEqual({ pendiente: 1, separado: 1, pagado: 1, incomplete: 1, quotes: 1 })
    expect(summary.shipments).toEqual({ arrived: 2, inTransit: 1, withoutCost: 1, unboxedShippingCop: 17_000 })
  })

  it('una caja sin llegada cuenta en el mes de creación en Bogotá', () => {
    // 2026-11-01T03:00Z es 31 de octubre a las 10 p. m. en Bogotá.
    expect(buildSummary(data, '2026-11').shipments.inTransit).toBe(0)
  })

  it('el inventario es una foto de hoy y no depende del mes', () => {
    const expected = { products: 4, availableUnits: 8, inTransitUnits: 2, soldOut: 1, toReview: 1 }
    expect(buildSummary(data, '2026-10').stock).toEqual(expected)
    expect(buildSummary(data, '2020-01').stock).toEqual(expected)
  })

  it('un mes sin movimiento da ceros', () => {
    const summary = buildSummary(data, '2020-01')
    expect(summary.billing.totalCop).toBe(0)
    expect(summary.profit.totalCop).toBe(0)
    expect(summary.shipments).toEqual({ arrived: 0, inTransit: 0, withoutCost: 0, unboxedShippingCop: 0 })
  })
})

describe('monthOptions', () => {
  it('meses con datos más el actual, del más reciente al más antiguo y sin repetir', () => {
    expect(monthOptions(data.orders, data.shipments, '2026-12-02')).toEqual(['2026-12', '2026-10', '2026-09'])
  })
})

describe('ganancia de envío', () => {
  it('cuenta una caja en camino apenas tiene costo del envío', () => {
    const withTransitCost = {
      ...data,
      shipments: [
        ...data.shipments,
        shipment({
          id: 'ENV-003',
          state: 'en_camino',
          shippedOn: '2026-10-25',
          realCostCop: 20_000,
          chargedCop: 27_000,
          differenceCop: 7_000,
        }),
      ],
    }
    const summary = buildSummary(withTransitCost, '2026-10')
    expect(summary.costs.shippingCostCop).toBe(30_000)
    expect(summary.profit.shippingCop).toBe(12_000)
    expect(summary.shipments).toMatchObject({ inTransit: 2, withoutCost: 1 })
  })
})
