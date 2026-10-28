import { describe, expect, it } from 'vitest'
import type { CashEntry } from '@/api/cash'
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
  stockShippingCop: 0,
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
  stockUnits: 0,
  productsCount: null,
  clientUnits: 0,
  unitsTotal: 0,
  costPerUnitCop: null,
  clientsRealCop: null,
  differenceCop: null,
  otherRealCop: null,
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
    // Su envío de 5.000 es de una venta del inventario: no se compara con cajas.
    order({ id: 'sept', orderedOn: '2026-09-20', status: 'comprado', itemsPriceCop: 20_000, shippingChargedCop: 5_000, totalCop: 25_000, itemsCostCop: 15_000, itemsProfitCop: 5_000, balanceCop: 25_000, incompleteItems: 1, stockShippingCop: 5_000 }),
  ],
  shipments: [
    // 10.000 entre 4 productos = 2.500 c/u; 2 son de pedidos (cobrado 15.000, real 5.000) y 2 de inventario.
    shipment({ id: 'ENV-001', state: 'llego', arrivedOn: '2026-10-18', realCostCop: 10_000, chargedCop: 15_000, clientUnits: 2, unitsTotal: 4, costPerUnitCop: 2_500, clientsRealCop: 5_000, differenceCop: 10_000, otherRealCop: 5_000 }),
    // Sin llegada ni despacho: cuenta en el mes en que se creó (en hora de Bogotá). Aún sin costo.
    shipment({ id: 'ENV-002', state: 'en_camino', createdAt: '2026-11-01T03:00:00Z', chargedCop: 4_000, clientUnits: 1, unitsTotal: 1 }),
    // Con costo pero sin productos: no se puede dividir.
    shipment({ id: 'ENV-003', state: 'en_camino', shippedOn: '2026-10-02', realCostCop: 20_000 }),
    // 8.000 por un solo producto de pedido que cobró 5.000: pérdida de 3.000.
    shipment({ id: 'ENV-000', state: 'llego', arrivedOn: '2026-09-30', realCostCop: 8_000, chargedCop: 5_000, clientUnits: 1, unitsTotal: 1, costPerUnitCop: 8_000, clientsRealCop: 8_000, differenceCop: -3_000, otherRealCop: 0 }),
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
    expect(summary.costs).toEqual({ productsCop: 112_946, shippingCostCop: 30_000 })
    expect(summary.profit).toEqual({ productsCop: 45_154, shippingCop: 10_000, totalCop: 55_154 })
    expect(summary.sales).toEqual({ pendiente: 0, separado: 1, pagado: 1, incomplete: 0, quotes: 1 })
    expect(summary.shipping).toEqual({
      chargedCop: 15_000,
      realCop: 5_000,
      profitCop: 10_000,
      inventoryShareCop: 5_000,
      stockSalesCop: 0,
      unboxedCop: 12_000,
      // ENV-002 aún no tiene costo.
      uncomparedBoxesCop: 4_000,
    })
    expect(summary.shipments).toMatchObject({ arrived: 1, inTransit: 2, withoutCost: 1, withoutProducts: 1 })
    expect(summary.shipments.boxes.map((s) => s.id)).toEqual(['ENV-001', 'ENV-002', 'ENV-003'])
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
    expect(summary.costs).toEqual({ productsCop: 127_946, shippingCostCop: 38_000 })
    expect(summary.profit).toEqual({ productsCop: 50_154, shippingCop: 7_000, totalCop: 57_154 })
    expect(summary.sales).toEqual({ pendiente: 1, separado: 1, pagado: 1, incomplete: 1, quotes: 1 })
    expect(summary.shipping).toEqual({
      chargedCop: 20_000,
      realCop: 13_000,
      profitCop: 7_000,
      inventoryShareCop: 5_000,
      stockSalesCop: 5_000,
      unboxedCop: 17_000,
      uncomparedBoxesCop: 4_000,
    })
    expect(summary.shipments).toMatchObject({ arrived: 2, inTransit: 2, withoutCost: 1, withoutProducts: 1 })
  })

  it('una caja con costo y sin productos no se compara ni cuenta como pérdida', () => {
    const summary = buildSummary({ ...data, shipments: [data.shipments[2]] }, '2026-10')
    expect(summary.profit.shippingCop).toBe(0)
    expect(summary.costs.shippingCostCop).toBe(20_000)
    expect(summary.shipments.withoutProducts).toBe(1)
  })

  it('una caja sin llegada cuenta en el mes de creación en Bogotá', () => {
    // 2026-11-01T03:00Z es 31 de octubre a las 10 p. m. en Bogotá.
    expect(buildSummary(data, '2026-11').shipments.inTransit).toBe(0)
    expect(buildSummary(data, '2026-10').shipments.boxes.map((s) => s.id)).toContain('ENV-002')
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
    expect(summary.shipping.profitCop).toBe(0)
    expect(summary.shipments).toEqual({ boxes: [], arrived: 0, inTransit: 0, withoutCost: 0, withoutProducts: 0 })
  })
})

describe('monthOptions', () => {
  it('meses con datos más el actual, del más reciente al más antiguo y sin repetir', () => {
    expect(monthOptions(data.orders, data.shipments, '2026-12-02')).toEqual(['2026-12', '2026-10', '2026-09'])
  })

  it('incluye los meses que solo tienen movimientos de plata', () => {
    const gasto: CashEntry = {
      id: 'm1',
      source: 'gasto',
      amountCop: 5_000,
      signedCop: -5_000,
      movedOn: '2026-08-14',
      orderId: null,
      shipmentId: null,
      label: null,
      method: null,
      note: null,
      createdAt: '2026-08-14T15:00:00Z',
    }
    expect(monthOptions(data.orders, data.shipments, '2026-12-02', [gasto])).toEqual([
      '2026-12',
      '2026-10',
      '2026-09',
      '2026-08',
    ])
  })
})

describe('ganancia de envío', () => {
  it('cuenta una caja en camino apenas tiene costo del envío', () => {
    const withTransitCost = {
      ...data,
      shipments: [
        ...data.shipments,
        // 20.000 entre 3 productos, todos de pedidos que cobraron 27.000.
        shipment({
          id: 'ENV-004',
          state: 'en_camino',
          shippedOn: '2026-10-25',
          realCostCop: 20_000,
          chargedCop: 27_000,
          clientUnits: 3,
          unitsTotal: 3,
          costPerUnitCop: 6_667,
          clientsRealCop: 20_000,
          differenceCop: 7_000,
          otherRealCop: 0,
        }),
      ],
    }
    const summary = buildSummary(withTransitCost, '2026-10')
    // 10.000 (ENV-001) + 20.000 (ENV-003, sin productos) + 20.000 (ENV-004)
    expect(summary.costs.shippingCostCop).toBe(50_000)
    expect(summary.profit.shippingCop).toBe(17_000)
    expect(summary.shipments).toMatchObject({ inTransit: 3, withoutCost: 1 })
  })
})
