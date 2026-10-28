import { describe, expect, it } from 'vitest'
import type { CashEntry } from '@/api/cash'
import type { OrderLineExport, OrderSummary } from '@/api/orders'
import type { Shipment } from '@/api/shipments'
import { csvDecimal, csvPercent, toCsv } from './csv'
import { cashFlowCsv, orderLinesCsv, ordersCsv, shipmentsCsv } from './exports'

/** Filas del CSV sin BOM ni el salto final. */
const lines = (csv: string) => csv.replace(/^﻿/, '').trimEnd().split('\r\n')

describe('toCsv', () => {
  it('empieza con BOM, separa con ; y termina cada fila en CRLF', () => {
    const csv = toCsv(['A', 'B'], [[1, 'x']])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toBe('﻿A;B\r\n1;x\r\n')
  })

  it('pone comillas solo cuando hace falta y duplica las internas', () => {
    expect(lines(toCsv(['x'], [['Cremas; juicy'], ['Dice "hola"'], ['dos\nlíneas'], ['normal']]))).toEqual([
      'x',
      '"Cremas; juicy"',
      '"Dice ""hola"""',
      '"dos\nlíneas"',
      'normal',
    ])
  })

  it('vacíos y sí/no', () => {
    expect(lines(toCsv(['a', 'b', 'c', 'd'], [[null, undefined, true, false]]))[1]).toBe(';;Sí;No')
  })

  it('decimales con coma y porcentajes que Excel reconoce', () => {
    expect(csvDecimal(4123.45)).toBe('4123,45')
    expect(csvDecimal(10)).toBe('10')
    expect(csvPercent(0.4)).toBe('40%')
    expect(csvPercent(0.355)).toBe('35,5%')
    expect(csvPercent(null)).toBeNull()
  })
})

describe('exportaciones', () => {
  it('pedidos: una fila por pedido con totales y estados', () => {
    const order: OrderSummary = {
      id: 'o1',
      customerId: 'c1',
      customerName: 'María',
      customerPhone: '3001234567',
      orderedOn: '2026-10-05',
      status: 'comprado',
      notes: null,
      itemsPriceCop: 112_000,
      itemsCostCop: 80_000,
      itemsProfitCop: 32_000,
      shippingChargedCop: 15_000,
      totalCop: 127_000,
      paidCop: 50_000,
      balanceCop: 77_000,
      paymentStatus: 'separado',
      incompleteItems: 0,
      stockShippingCop: 0,
      stockShippingUnits: 0,
      stockBoxedUnits: 0,
      stockBoxedRealCop: 0,
    }
    expect(lines(ordersCsv([order]))[1]).toBe(
      '05/10/2026;María;3001234567;Comprado;Separado;112000;15000;127000;80000;32000;50000;77000;0;',
    )
  })

  it('productos vendidos: como la hoja "Productos y ventas"', () => {
    const line: OrderLineExport = {
      id: 'l1',
      productId: 'p1',
      description: 'Crema Medicube',
      qty: 1,
      unitCostUsd: 7.99,
      trm: 4123.45,
      markupPct: 0.4,
      unitPriceCop: null,
      markupEffective: 0.4,
      shippingChargedCop: 0,
      costCop: 32_946,
      priceCop: 46_100,
      profitCop: 13_154,
      incomplete: false,
      fromStock: false,
      shipmentId: 's1',
      shipmentCode: 'ENV-001',
      orderedOn: '2026-10-10',
      orderStatus: 'entregado',
      customerName: 'Ana',
    }
    expect(lines(orderLinesCsv([line]))[1]).toBe(
      '10/10/2026;Ana;Crema Medicube;1;7,99;4123,45;32946;40%;46100;0;46100;ENV-001;No;No;Entregado',
    )
  })

  it('cajas: con despacho, llegada estimada e inventario; sin comparativa mientras no hay costo', () => {
    const shipment: Shipment = {
      id: 's1',
      code: 'ENV-002',
      carrier: 'Aeropost',
      shippedOn: '2026-10-20',
      expectedOn: '2026-10-31',
      arrivedOn: null,
      realCostCop: null,
      notes: 'frágil',
      itemsCount: 3,
      chargedCop: 27_000,
      state: 'en_camino',
      stockUnits: 4,
      productsCount: null,
      clientUnits: 3,
      unitsTotal: 7,
      costPerUnitCop: null,
      clientsRealCop: null,
      differenceCop: null,
      otherRealCop: null,
      createdAt: '2026-10-20T15:00:00Z',
    }
    expect(lines(shipmentsCsv([shipment]))[1]).toBe('ENV-002;Aeropost;20/10/2026;31/10/2026;;En camino;7;3;4;;;27000;;;;frágil')
  })

  it('cajas: con costo, la comparativa por producto', () => {
    const shipment: Shipment = {
      id: 's2',
      code: 'ENV-003',
      carrier: null,
      shippedOn: '2026-10-01',
      expectedOn: null,
      arrivedOn: '2026-10-15',
      realCostCop: 309_000,
      notes: null,
      itemsCount: 1,
      chargedCop: 60_000,
      state: 'llego',
      stockUnits: 3,
      productsCount: 20,
      clientUnits: 2,
      unitsTotal: 20,
      costPerUnitCop: 15_450,
      clientsRealCop: 30_900,
      differenceCop: 29_100,
      otherRealCop: 278_100,
      createdAt: '2026-10-01T15:00:00Z',
    }
    expect(lines(shipmentsCsv([shipment]))[1]).toBe(
      'ENV-003;;01/10/2026;;15/10/2026;Llegó;20;2;3;309000;15450;60000;30900;29100;278100;',
    )
  })

  it('flujo de caja: valor con signo, tipo y cliente o caja', () => {
    const base = { orderId: null, shipmentId: null, method: null, note: null, createdAt: '' }
    const entries: CashEntry[] = [
      { ...base, id: 'a', source: 'abono', amountCop: 50_000, signedCop: 50_000, movedOn: '2026-10-05', label: 'Ana', method: 'Nequi' },
      { ...base, id: 'b', source: 'reinversion', amountCop: 80_000, signedCop: -80_000, movedOn: '2026-10-06', label: 'Ana', note: 'Amazon' },
    ]
    expect(lines(cashFlowCsv(entries))).toEqual([
      'Fecha;Tipo;Entra o sale;Valor (COP);Cliente o caja;Medio;Nota',
      '05/10/2026;Abono de cliente;Entra;50000;Ana;Nequi;',
      '06/10/2026;Reinversión;Sale;-80000;Ana;;Amazon',
    ])
  })
})
